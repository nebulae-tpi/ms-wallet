// para crear una unidad de negocio
const tocreateBusiness = {
  "id": "b45621e6-b998-445c-b9bf-cec3a5ca4ae2",
  "data": {
    "et": "BusinessCreated",
    "etv": 1,
    "at": "Business",
    "data": {
      "_id": "GANA_MED",
      "generalInfo": { "name": "Gana_mede" },
      "state": "true"
    },
    "user": "juan.santa",
    "timestamp": 1540412513776,
    "av": 28,
    "_id": "5adcf56fa83eef092fdb4ab8"
  },
  "attributes": { "senderId": "6496d1ce-a520-4d0e-9a67-e516dc1153cd" }
};

// para actualizar una unidad de negocio
const toEdit = {
  "id": "b45621e6-b998-445c-b9bf-cec3a5ca4ae2",
  "data": {
    "et": "BusinessGeneralInfoUpdated",
    "etv": 1,
    "at": "Business",
    "aid": "GANA_MED",
    "data": { "name": "Gana_MEDELLIN" },
    "user": "juan.santa",
    "timestamp": 1540412513776,
    "av": 28,
    "_id": "5adcf56fa83eef092fdb4ab8"
  },
  "attributes": { "senderId": "6496d1ce-a520-4d0e-9a67-e516dc1153cd" }
};

const onWalletSpendingCommited = {
  "id": "b45621e6-b998-445c-b9bf-cec3a5ca4ae2",
  "data": {
    "et": "WalletSpendingCommited",
    "etv": 1,
    "at": "Wallet",
    "aid": "5bd0fc425c88675e86b5b326",
    "data": {
      "businessId": "GANA_MED",
      "type": "VENTA",
      "concept": "RECARGA_CIVICA",
      "value": 5000,
      "terminal": {
        "id": "terminalID",
        "userId" : "JUAN_SANTA_POS_USER",
        "username": "JUAN_FELIPE_SANTA_OSPINA"
      },
      "user": "USER_EVENT",
      "notes": "WALLET SPENDING COMMITED NOTES ...",
      "location": { "type": "Point", "coordinates": [125.6, 10.1] }
    },
    "user": "juan.santa",
    "timestamp": 1540412513776,
    "av": 28,
    "_id": "5adcf56fa83eef092fdb4ab8"
  },
  "attributes": { "senderId": "6496d1ce-a520-4d0e-9a67-e516dc1153cd" }
};
