//Every single error code
// please use the prefix assigned to this microservice
const INTERNAL_SERVER_ERROR = {code: 19001, description: 'Internal server error'};
const PERMISSION_DENIED_ERROR = {code: 19002, description: 'Permission denied'};
const NO_WALLET_ID_IN_AUTH_TOKEN = {code: 19003, description: 'NO ENOUGH INFO IN REQUEST, PLEASE RESET THE CREDENTIALS'};


module.exports =  { 
    PERMISSION_DENIED_ERROR,
    INTERNAL_SERVER_ERROR,
    NO_WALLET_ID_IN_AUTH_TOKEN,
    DRIVER_ID_NO_FOUND_IN_TOKEN : { code: 19004, description: 'DRIVER ID NO FOUND IN JWT TOKEN'},
    MISSING_TRANSACTIONS_TO_REVERT: { code: 19005, description: 'Transaction Ids are required to make revert operation' },
    TRANSACTION_NO_FOUND: { code: 19006, description: 'Transaction to revert no found' },
    TRANSACTION_ALREADY_REVERTED: { code: 19007, description: 'Transaction Already Reverted'},
    INSUFFICIENT_BALANCE: { code: 19008, description: 'Insufficient balance to make the revert'}
} 