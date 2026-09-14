export type RuleField =
  | 'payee'
  | 'memo'
  | 'amount'
  | 'accountId'
  | 'paymentMethod'
  | 'type';

export type RuleOperator =
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'REGEX'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'BETWEEN';

export type RuleMatchMode = 'ALL' | 'ANY';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string | number | [number, number];
}

export interface RuleActions {
  setCategoryId?: string | null;
  setPayeeId?: string | null;
  setPayeeName?: string | null;
  addTagIds?: string[];
  stopProcessing?: boolean;
}

export interface TransactionRule {
  id: string;
  userId: string;
  name: string;
  priority: number;
  isActive: boolean;
  matchMode: RuleMatchMode;
  conditions: RuleCondition[];
  actions: RuleActions;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleDto {
  name: string;
  priority?: number;
  isActive?: boolean;
  matchMode?: RuleMatchMode;
  conditions: RuleCondition[];
  actions: RuleActions;
}

export interface UpdateRuleDto extends Partial<CreateRuleDto> {}

export interface ReorderRulesDto {
  ruleIds: string[];
}

export interface TestRuleCandidate {
  payee?: string | null;
  memo?: string | null;
  amount?: number | string | null;
  accountId?: string | null;
  paymentMethod?: string | null;
  type?: 'DEBIT' | 'CREDIT' | null;
}

export interface TestRuleDto {
  ruleId?: string;
  rule?: CreateRuleDto;
  candidate?: TestRuleCandidate;
  testAgainstRecent?: boolean;
  sampleLimit?: number;
}

export interface ApplyRulesDto {
  ruleIds?: string[];
  onlyUncategorized?: boolean;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  dryRun?: boolean;
}

export interface ApplyRulesResult {
  matchedCount: number;
  updatedCount: number;
  dryRun: boolean;
  details: Array<{
    transactionId: string;
    ruleId: string;
    ruleName: string;
    payee: string | null;
    amount: string;
    appliedCategoryId: string | null;
  }>;
}
