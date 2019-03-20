//Every single error code
// please use the prefix assigned to this microservice
const INTERNAL_SERVER_ERROR = {code: 19001, description: 'Internal server error'};
const PERMISSION_DENIED_ERROR = {code: 19002, description: 'Permission denied'};


module.exports =  { 
    PERMISSION_DENIED_ERROR,
    INTERNAL_SERVER_ERROR,
} 