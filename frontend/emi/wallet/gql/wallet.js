import gql from "graphql-tag";

// We use the gql tag to parse our query string into a query document

// QUERIES

export const getBusinessByFilter = gql`
  query getBusinessByFilter($filterText: String, $limit: Int) {
    getBusinessByFilter(filterText: $filterText, limit: $limit) {
      _id
      name
    }
  }
`;

export const getWalletBusiness = gql`
  query getWalletBusiness {
    getWalletBusiness {
      _id
      name
    }
  }
`;

export const getWalletBusinesses = gql`
  query getWalletBusinesses {
    getWalletBusinesses {
      _id
      name
    }
  }
`;

export const getWalletBusinessById = gql`
  query getWalletBusinessById($id: ID!)  {
    getWalletBusinessById(id: $id) {
      _id
      name
    }
  }
`;

export const getWallet = gql`
  query getWallet($businessId: String!) {
    getWallet(businessId: $businessId) {
      _id
      pockets {
        main
        bonus
      }
      spendingState
      businessId
    }
  }
`;

export const getWalletTransactionsHistory = gql`
  query getWalletTransactionsHistory($filterInput: FilterInput!, $paginationInput: PaginationInput!) {
    getWalletTransactionsHistory(filterInput: $filterInput, paginationInput: $paginationInput) {
      _id
      timestamp
      businessId
      type
      concept
      pocket
      value
      user
      notes
      terminal {
        id
        userId
        username
      }
      location {
        type
        coordinates
      }
    }
  }
`;

export const getWalletTransactionsHistoryAmount = gql`
  query getWalletTransactionsHistoryAmount($filterInput: FilterInput!) {
    getWalletTransactionsHistoryAmount(filterInput: $filterInput)
  }
`;

export const getWalletTransactionsHistoryById = gql`
  query getWalletTransactionsHistoryById($id: ID!) {
    getWalletTransactionsHistoryById(id: $id) {
      _id
      timestamp
      businessId
      type
      concept
      pocket
      value
      user
      notes
      associatedTransactionIds
      terminal {
        id
        userId
        username
      }
      location {
        type
        coordinates
      }
    }
  }
`;

export const getAssociatedTransactionsHistoryByTransactionHistoryId = gql`
  query getAssociatedTransactionsHistoryByTransactionHistoryId($id: ID!) {
    getAssociatedTransactionsHistoryByTransactionHistoryId(id: $id) {
      _id
      timestamp
      businessId
      type
      concept
      pocket
      value
      user
      notes
      terminal {
        id
        userId
        username
      }
      location {
        type
        coordinates
      }
    }
  }
`;

export const getTypesAndConcepts = gql`
  query getTypesAndConcepts  {
    typeAndConcepts{
      type
      concepts
    }
  }
`;

export const getWalletErrors = gql`
  query getWalletErrors($page: Int!, $count: Int!, $errorType: String){
    getWalletErrors(page: $page, count: $count, errorType: $errorType){
      timestamp
      error
      type
      event
    }
  }
`;

export const getWalletErrorsCount = gql`
  query getWalletErrorsCount($errorType: String){
    getWalletErrorsCount(errorType: $errorType)
  }
`;

// MUTATIONS
export const makeManualBalanceAdjustment = gql`
  mutation makeManualBalanceAdjustment($input: ManualBalanceAdjustmentInput) {
    makeManualBalanceAdjustment(input: $input) {
      code
      message
    }
  }
`;


//SUBSCRIPTIONS
export const walletPocketUpdated = gql`
  subscription walletPocketUpdated($businessId: String!) {
    walletPocketUpdated(businessId: $businessId) {
      _id
      pockets {
        main
        bonus
      }
      spendingState
      businessId
    }
  }
`;
