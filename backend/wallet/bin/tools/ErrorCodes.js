//Every single error code
// please use the prefix assigned to this microservice
const INTERNAL_SERVER_ERROR = {code: 19001, description: 'Internal server error'};
const PERMISSION_DENIED_ERROR = {code: 19002, description: 'Permission denied'};
const NO_WALLET_ID_IN_AUTH_TOKEN = {code: 19003, description: 'NO ENOUGH INFO IN REQUEST, PLEASE RESET THE CREDENTIALS'};


module.exports =  { 
    PERMISSION_DENIED_ERROR,
    INTERNAL_SERVER_ERROR,
    NO_WALLET_ID_IN_AUTH_TOKEN
} 