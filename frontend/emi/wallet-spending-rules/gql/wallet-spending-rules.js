import gql from "graphql-tag";

export const getSpendingRulesQuantity = gql `
query{
  WalletSpendingRuleQuantity
}`;

export const getTypeAndConcepts = gql`
  query typeAndConcepts {
  typeAndConcepts{
    type
    concepts
  }
}
`;

export const getSpendingRule = gql`
  query WalletGetSpendingRule($businessId: String) {
    WalletGetSpendingRule(businessId: $businessId) {
      id
      businessId
      businessName
      minOperationAmount
      productBonusConfigs {
        type
        concept
        bonusType
        bonusValueByMain
        bonusValueByCredit
      }
      autoPocketSelectionRules {
        priority
        pocketToUse
        condition {
          pocket
          comparator
          value
        }
      }
      lastEditionTimestamp
      editedBy
    }
  }
`;

export const getSpendingRules = gql`query  WalletGetSpendingRules($page: Int!, $count: Int!, $filter: String, $sortColumn: String, $sortOrder: String   ){
  WalletGetSpendingRules(page: $page, count: $count,filter: $filter,sortColumn: $sortColumn,sortOrder: $sortOrder){
    id
    businessId
    businessName
    minOperationAmount
    productBonusConfigs{
      type
      concept
      bonusType
      bonusValueByMain
      bonusValueByCredit
    }
    autoPocketSelectionRules{
      priority
      pocketToUse
      condition{
        pocket
        comparator
        value
      }
    }
    lastEditionTimestamp
    editedBy

  }
}
`;



export const updateSpendingRule = gql`
  mutation updateSpendingRule($input: WalletSpendingRuleInput) {
    walletUpdateSpendingRule(input: $input) {
      code
      message
    }
  }
`;

//Hello world sample, please remove
export const walletHelloWorldSubscription = gql`
  subscription {
    walletHelloWorldSubscription {
      sn
    }
  }
`;
