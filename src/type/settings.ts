export type AppSettings = {
  general: {
    currency: "USD" | "EUR" | "CLP";
    weekStartsOn: "monday" | "sunday";
  };
  overhead: {
    dailyFixedAmount: number;
    distributionRule:
      | "all-active"
      | "only-with-production"
      | "single-project";
  };
  ui: {
    priceListDefaultSort: "name" | "customer" | "last-updated";
    defaultAccordionState:
      | "open-all"
      | "closed-all"
      | "remember-last";
  };
};