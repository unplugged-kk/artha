export enum RuleField {
  PAYEE = "payee",
  MEMO = "memo",
  AMOUNT = "amount",
  ACCOUNT_ID = "accountId",
  PAYMENT_METHOD = "paymentMethod",
  TYPE = "type",
}

export enum RuleOperator {
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
  EQUALS = "EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  REGEX = "REGEX",
  GREATER_THAN = "GREATER_THAN",
  LESS_THAN = "LESS_THAN",
  BETWEEN = "BETWEEN",
}

export enum RuleMatchMode {
  ALL = "ALL",
  ANY = "ANY",
}
