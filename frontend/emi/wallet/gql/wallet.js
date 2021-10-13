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

export const getWalletsByFilter = gql`
  query getWalletsByFilter($filterText: String, $businessId: String, $limit: Int) {
    getWalletsByFilter(filterText: $filterText, businessId: $businessId, limit: $limit) {
      _id
      fullname
      type
      documentId
      pockets{
        main
        bonus
      }
    }
  }
`;
export const getMyWallet = gql`
  query getMyWallet{
    getMyWallet{
      _id
      fullname
      type
      documentId
      pockets{
        main
        bonus
      }
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
  query getWallet($walletId: String!) {
    getWallet(walletId: $walletId) {
      _id
      fullname
      documentId
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
  query getWalletTransactionsHistory($filterInput: WalletTransactionsFilterInput!, $paginationInput: PaginationInput!) {
    getWalletTransactionsHistory(filterInput: $filterInput, paginationInput: $paginationInput) {
      _id
      timestamp
      walletId
      type
      concept
      pocket
      amount
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
  query getWalletTransactionsHistoryAmount($filterInput: WalletTransactionsFilterInput!) {
    getWalletTransactionsHistoryAmount(filterInput: $filterInput)
  }
`;

export const getWalletTransactionsHistoryById = gql`
  query getWalletTransactionsHistoryById($id: ID!) {
    getWalletTransactionsHistoryById(id: $id) {
      _id
      timestamp
      businessId
      walletId
      type
      concept
      pocket
      amount
      user
      notes
      reverted
      associatedTransactionIds
    }
  }
`;

export const getAssociatedTransactionsHistoryByTransactionHistoryId = gql`
  query getAssociatedTransactionsHistoryByTransactionHistoryId($id: ID!) {
    getAssociatedTransactionsHistoryByTransactionHistoryId(id: $id) {
      _id
      timestamp
      walletId
      type
      concept
      pocket
      amount
      user
      notes
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

export const WalletRevertTransaction = gql`
  mutation WalletRevertTransaction($businessId: String!, $transactionIds: [String]!, $concept: String) {
    WalletRevertTransaction(businessId: $businessId, transactionIds: $transactionIds, concept: $concept) {
      code
      message
    }
  }
`;


//SUBSCRIPTIONS
export const walletPocketUpdated = gql`
  subscription walletPocketUpdated($walletId: String!) {
    walletPocketUpdated(walletId: $walletId) {
      _id
      documentId
      type
      fullname
      pockets {
        main
        bonus
      }
      spendingState
      businessId
    }
  }
`;
