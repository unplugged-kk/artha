import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../../common/db/scoped-db";
import { SmsSenderRegistry } from "./entities/sms-sender-registry.entity";
import { Account } from "../../accounts/entities/account.entity";
import {
  CreateSmsSenderDto,
  UpdateSmsSenderDto,
  SmsSenderResponseDto,
} from "./dto/sms-sender-registry.dto";
import {
  normalizeSenderPattern,
  KNOWN_INDIAN_BANKS,
  BankMetadata,
} from "./parsers/bank-sender-registry.data";

@Injectable()
export class SmsSenderRegistryService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Returns known Indian bank sender patterns and institutions.
   */
  getKnownBanks(): BankMetadata[] {
    return Object.values(KNOWN_INDIAN_BANKS);
  }

  /**
   * Lists all sender registry entries for the authenticated user.
   */
  async listSenders(userId: string): Promise<SmsSenderResponseDto[]> {
    return withScopedDb(this.dataSource, async (manager) => {
      const senders = await manager.find(SmsSenderRegistry, {
        where: { userId },
        relations: ["account"],
        order: { senderPattern: "ASC" },
      });

      return senders.map((s) => ({
        id: s.id,
        senderPattern: s.senderPattern,
        accountId: s.accountId,
        accountName: s.account?.name ?? null,
        displayName: s.displayName,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    });
  }

  /**
   * Registers a new sender pattern mapping for the authenticated user.
   */
  async createSender(
    userId: string,
    dto: CreateSmsSenderDto,
  ): Promise<SmsSenderResponseDto> {
    const normalizedPattern = normalizeSenderPattern(dto.senderPattern);
    if (!normalizedPattern) {
      throw new BadRequestException("Invalid sender pattern");
    }

    return withScopedDb(this.dataSource, async (manager) => {
      // If accountId provided, verify it belongs to user
      let account: Account | null = null;
      if (dto.accountId) {
        account = await manager.findOne(Account, {
          where: { id: dto.accountId, userId },
        });
        if (!account) {
          throw new NotFoundException("Mapped account not found");
        }
      }

      // Check for duplicate pattern
      const existing = await manager.findOne(SmsSenderRegistry, {
        where: { userId, senderPattern: normalizedPattern },
      });
      if (existing) {
        throw new ConflictException(
          `Sender pattern "${normalizedPattern}" is already registered`,
        );
      }

      const entity = manager.create(SmsSenderRegistry, {
        userId,
        senderPattern: normalizedPattern,
        accountId: dto.accountId || null,
        displayName: dto.displayName || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      });

      const saved = await manager.save(entity);

      return {
        id: saved.id,
        senderPattern: saved.senderPattern,
        accountId: saved.accountId,
        accountName: account?.name ?? null,
        displayName: saved.displayName,
        isActive: saved.isActive,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
    });
  }

  /**
   * Updates an existing sender mapping.
   */
  async updateSender(
    userId: string,
    id: string,
    dto: UpdateSmsSenderDto,
  ): Promise<SmsSenderResponseDto> {
    return withScopedDb(this.dataSource, async (manager) => {
      const entity = await manager.findOne(SmsSenderRegistry, {
        where: { id, userId },
        relations: ["account"],
      });
      if (!entity) {
        throw new NotFoundException("Sender registry entry not found");
      }

      let accountName = entity.account?.name ?? null;

      if (dto.accountId !== undefined) {
        if (dto.accountId === null) {
          entity.accountId = null;
          accountName = null;
        } else {
          const acc = await manager.findOne(Account, {
            where: { id: dto.accountId, userId },
          });
          if (!acc) {
            throw new NotFoundException("Mapped account not found");
          }
          entity.accountId = dto.accountId;
          accountName = acc.name;
        }
      }

      if (dto.displayName !== undefined) {
        entity.displayName = dto.displayName;
      }
      if (dto.isActive !== undefined) {
        entity.isActive = dto.isActive;
      }

      const saved = await manager.save(entity);

      return {
        id: saved.id,
        senderPattern: saved.senderPattern,
        accountId: saved.accountId,
        accountName,
        displayName: saved.displayName,
        isActive: saved.isActive,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
    });
  }

  /**
   * Deletes a sender mapping.
   */
  async deleteSender(userId: string, id: string): Promise<void> {
    return withScopedDb(this.dataSource, async (manager) => {
      const result = await manager.delete(SmsSenderRegistry, { id, userId });
      if (result.affected === 0) {
        throw new NotFoundException("Sender registry entry not found");
      }
    });
  }

  /**
   * Attempts to resolve an account from the sender pattern for a user.
   */
  async resolveAccountForSender(
    userId: string,
    sender?: string,
  ): Promise<Account | null> {
    if (!sender) return null;
    const normalizedPattern = normalizeSenderPattern(sender);
    if (!normalizedPattern) return null;

    return withScopedDb(this.dataSource, async (manager) => {
      // 1. Check exact normalized pattern match in user's registry
      const entry = await manager.findOne(SmsSenderRegistry, {
        where: { userId, senderPattern: normalizedPattern, isActive: true },
        relations: ["account"],
      });

      if (entry && entry.account) {
        return entry.account;
      }

      // 2. Check full raw pattern match in user's registry
      const rawEntry = await manager.findOne(SmsSenderRegistry, {
        where: {
          userId,
          senderPattern: sender.trim().toUpperCase(),
          isActive: true,
        },
        relations: ["account"],
      });

      if (rawEntry && rawEntry.account) {
        return rawEntry.account;
      }

      return null;
    });
  }
}
