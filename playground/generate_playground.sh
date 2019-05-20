#!/bin/bash

# FrontEnd - EMI composition
nebulae compose-ui development --shell-type=FUSE2_ANGULAR --shell-repo=https://github.com/nebulae-tpi/emi --frontend-id=emi --output-dir=emi  --setup-file=../etc/mfe-setup.json

# API - EMI GateWay composition
nebulae compose-api development --api-type=NEBULAE_GATEWAY --api-repo=https://github.com/nebulae-tpi/emi-gateway --api-id=emi-gateway --output-dir=emi-gateway  --setup-file=../etc/emi-mapi-setup.json
# API - SALES GateWay composition
# nebulae compose-api development --api-type=NEBULAE_GATEWAY --api-repo=https://github.com/nebulae-pyxis/sales-gateway --api-id=sales-gateway --output-dir=sales-gateway  --setup-file=../etc/sales-mapi-setup.json

# API - DRIVER GateWay composition
nebulae compose-api development --api-type=NEBULAE_GATEWAY --api-repo=https://github.com/nebulae-tpi/driver-gateway --api-id=driver-gateway --output-dir=driver-gateway  --setup-file=../etc/mapi-driver-setup.json

# API - CLIENT gateway composition
nebulae compose-api development --api-type=NEBULAE_GATEWAY --api-repo=https://github.com/nebulae-tpi/client-gateway --api-id=client-gateway --output-dir=client-gateway  --setup-file=../etc/mapi-client-setup.json
