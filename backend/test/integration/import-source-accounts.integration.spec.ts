import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { ImportModule } from "@/import/import.module";
import { ImportService } from "@/import/import.service";
import { ImportCsvDto } from "@/import/dto/import.dto";
import { Account, AccountType } from "@/accounts/entities/account.entity";
import { Transaction } from "@/transactions/entities/transaction.entity";
import { withUserContext } from "@/common/db/with-context";
import { NetWorthService } from "@/net-worth/net-worth.service";
import {
  createIntegrationModule,
  cleanTables,
  createTestUserDirect,
} from "../helpers/integration-setup";
import { createTestAccount } from "../helpers/test-factories";

/**
 * A household tracker names each row's account in a column. These cases hold
 * the money contract at the public import boundary against PostgreSQL:
 * every row lands in its own account, the batch commits whole or not at all,
 * and a retry of the same rows -- immediate, under another file name, or
 * concurrent -- moves no balance. (The file name never reaches the server, so
 * a renamed file is the same request as an immediate retry.)
 */
const HEADER = "#,Date,Amount,Source,Description,Payee";
// As the XLSX reader emits it: the numbered placeholder row and the TOTAL
// footer are already gone (xlsx-sheet-reader.util.spec.ts holds that).
const A1_ROWS = [
  "1,2026-10-31,100,Test Bank,Groceries,Synthetic Shop",
  "3,2026-11-01,40,Test Card,Fuel,Synthetic Fuel",
  "4,2026-11-02,40,Test Bank,Card payment,",
  "5,2026-11-03,100,Test Bank,Groceries,Synthetic Shop",
];

describe("CSV/XLSX import routed by a source-account column (integration)", () => {
  let module: TestingModule;
  let service: ImportService;
  let dataSource: DataSource;
  let userId: string;
  let bank: Account;
  let card: Account;

  beforeAll(async () => {
    module = await createIntegrationModule([ImportModule]);
    service = module.get(ImportService);
    dataSource = module.get(DataSource);
    // Post-import processing starts a net-worth recalc per account that it
    // never awaits; left running it deadlocks the next test's TRUNCATE.
    jest
      .spyOn(module.get(NetWorthService), "recalculateAccount")
      .mockResolvedValue(undefined as never);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await cleanTables(dataSource, [
      "action_history",
      "transaction_splits",
      "transactions",
      "accounts",
      "categories",
      "payees",
      "monthly_account_balances",
      "users",
    ]);
    userId = (await createTestUserDirect(dataSource)).id;
    bank = await createTestAccount(dataSource, userId, {
      name: "Test Bank",
      openingBalance: 1000,
      currentBalance: 1000,
    });
    card = await createTestAccount(dataSource, userId, {
      name: "Test Card",
      accountType: AccountType.CREDIT_CARD,
      openingBalance: 0,
      currentBalance: 0,
    });
  });

  function dto(rows: string[], overrides: Partial<ImportCsvDto> = {}) {
    return {
      content: [HEADER, ...rows].join("\n"),
      columnMapping: {
        date: 1,
        amount: 2,
        sourceAccountColumn: 3,
        payee: 4,
        dateFormat: "YYYY-MM-DD",
        reverseSign: true,
        hasHeader: true,
        delimiter: ",",
      },
      transferRules: [
        { type: "payee", pattern: "Card payment", accountName: "Test Card" },
      ],
      categoryMappings: [],
      accountMappings: [{ originalName: "Test Card", accountId: card.id }],
      sourceAccountMappings: [
        { originalName: "Test Bank", accountId: bank.id },
        { originalName: "Test Card", accountId: card.id },
      ],
      ...overrides,
    } as ImportCsvDto;
  }

  const run = (body: ImportCsvDto) =>
    withUserContext(userId, () => service.importCsvFile(userId, body));

  async function balances() {
    const rows = await dataSource.manager.find(Account, {
      where: { userId },
    });
    const of = (id: string) =>
      Number(rows.find((a) => a.id === id)!.currentBalance);
    return { bank: of(bank.id), card: of(card.id) };
  }

  const postings = () =>
    dataSource.manager.count(Transaction, { where: { userId } });

  it("posts every row to its own account (A1)", async () => {
    const result = await run(dto(A1_ROWS));

    expect(result.errors).toBe(0);
    expect(await balances()).toEqual({ bank: 760, card: 0 });
    // Four source rows; the card payment is two linked postings.
    expect(await postings()).toBe(5);
    const transfer = await dataSource.manager.findOneOrFail(Transaction, {
      where: { accountId: bank.id, isTransfer: true },
    });
    expect(Number(transfer.amount)).toBe(-40);
    const leg = await dataSource.manager.findOneOrFail(Transaction, {
      where: { id: transfer.linkedTransactionId! },
    });
    expect(leg.accountId).toBe(card.id);
    expect(Number(leg.amount)).toBe(40);
  });

  it("moves no balance on an immediate retry", async () => {
    await run(dto(A1_ROWS));
    const again = await run(dto(A1_ROWS));

    expect(again.imported).toBe(0);
    expect(again.errors).toBe(0);
    expect(await balances()).toEqual({ bank: 760, card: 0 });
    expect(await postings()).toBe(5);
  });

  it("converges when the same batch is submitted twice concurrently", async () => {
    const outcomes = await Promise.allSettled([
      run(dto(A1_ROWS)),
      run(dto(A1_ROWS)),
    ]);

    expect(outcomes.some((o) => o.status === "fulfilled")).toBe(true);
    expect(await balances()).toEqual({ bank: 760, card: 0 });
    expect(await postings()).toBe(5);
  });

  it("writes nothing while an unreadable row is unresolved, and skips it only on request", async () => {
    const rows = [...A1_ROWS, "6,2026-11-04,abc,Test Bank,Groceries,"];

    await expect(run(dto(rows))).rejects.toThrow(/could not be read/);
    expect(await balances()).toEqual({ bank: 1000, card: 0 });
    expect(await postings()).toBe(0);

    const result = await run(dto(rows, { skipRejectedRows: true }));
    expect(result.skipped).toBe(1);
    expect(result.errorMessages.join()).toMatch(/Row 6 skipped as unreadable/);
    expect(await balances()).toEqual({ bank: 760, card: 0 });
  });

  it("writes nothing while a source label has no account", async () => {
    const rows = [...A1_ROWS, "6,2026-11-04,10,Cash Wallet,Tea,"];

    await expect(run(dto(rows))).rejects.toThrow(/Cash Wallet/);
    expect(await postings()).toBe(0);
  });

  it("leaves the first account untouched when a later account is not the user's", async () => {
    const stranger = await createTestUserDirect(dataSource);
    const foreign = await createTestAccount(dataSource, stranger.id, {
      name: "Foreign",
    });
    const body = dto(A1_ROWS, {
      sourceAccountMappings: [
        { originalName: "Test Bank", accountId: bank.id },
        { originalName: "Test Card", accountId: foreign.id },
      ],
    });

    await expect(run(body)).rejects.toThrow();
    expect(await balances()).toEqual({ bank: 1000, card: 0 });
    expect(await postings()).toBe(0);
  });

  it("keeps two genuinely identical purchases as two postings", async () => {
    const twin = "1,2026-11-05,25,Test Bank,Tea stall,";
    await run(dto([twin, twin.replace(/^1/, "2")]));

    expect(await balances()).toEqual({ bank: 950, card: 0 });
    expect(await postings()).toBe(2);
  });

  it("honours a skipped label and a per-row override", async () => {
    const result = await run(
      dto(A1_ROWS, {
        transferRules: [],
        accountMappings: [],
        sourceAccountMappings: [
          { originalName: "Test Bank", accountId: bank.id },
          { originalName: "Test Card", skip: true },
        ],
        // File row 4 is "Card payment" (header is row 1): post it to the card.
        sourceRowOverrides: [{ rowNumber: 4, accountId: card.id }],
      }),
    );

    expect(result.skipped).toBe(1);
    expect(await balances()).toEqual({ bank: 800, card: -40 });
  });
});
