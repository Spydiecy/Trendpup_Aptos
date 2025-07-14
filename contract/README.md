# TrendPup Access Control Contract

This directory contains the Aptos Move smart contract for TrendPup's access control system. Users pay 1 APT to gain 30-day access to the premium AI memecoin intelligence platform.

## 📁 Directory Structure

```
contract/
├── Move.toml                 # Package configuration
├── sources/
│   └── access_control.move   # Main contract source code
├── scripts/
│   ├── deploy.sh            # Deployment script
│   └── test_contract.sh     # Testing script
├── integration.ts           # TypeScript integration for frontend
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Install Aptos CLI**:
   ```bash
   curl -fsSL https://aptos.dev/scripts/install_cli.py | python3
   ```

2. **Verify installation**:
   ```bash
   aptos --version
   ```

### Deployment

1. **Navigate to contract directory**:
   ```bash
   cd contract
   ```

2. **Run deployment script**:
   ```bash
   ./scripts/deploy.sh
   ```

   This will:
   - Initialize an Aptos account (if needed)
   - Fund the account on testnet
   - Compile the contract
   - Run tests
   - Deploy the contract
   - Initialize the platform

3. **Note the contract address** from the deployment output for frontend integration.

### Testing

After deployment, test the contract:

```bash
./scripts/test_contract.sh <CONTRACT_ADDRESS>
```

## 📋 Contract Features

### Core Functions

- **`purchase_access()`** - Users pay 1 APT to gain access
- **`has_access(address)`** - Check if user has active access
- **`get_access_info(address)`** - Get detailed access information
- **`get_platform_config()`** - View platform settings

### Admin Functions

- **`update_config(fee, duration)`** - Update access fee and duration
- **`revoke_access(address)`** - Emergency access revocation
- **`withdraw_treasury(amount)`** - Withdraw collected fees

### View Functions

- **`get_access_fee()`** - Current access fee (1 APT = 100,000,000 octas)
- **`get_access_duration()`** - Access duration (30 days = 2,592,000 seconds)
- **`is_initialized()`** - Check if platform is set up

## 💰 Fee Structure

- **Access Fee**: 1 APT (100,000,000 octas)
- **Access Duration**: 30 days (2,592,000 seconds)
- **Payment Method**: APT tokens
- **Treasury**: Configurable address for fee collection

## 🔧 Manual Contract Interaction

### Purchase Access
```bash
aptos move run \
    --function-id <CONTRACT_ADDRESS>::access_control::purchase_access \
    --assume-yes
```

### Check Access
```bash
aptos move view \
    --function-id <CONTRACT_ADDRESS>::access_control::has_access \
    --args address:<USER_ADDRESS>
```

### View Access Info
```bash
aptos move view \
    --function-id <CONTRACT_ADDRESS>::access_control::get_access_info \
    --args address:<USER_ADDRESS>
```

### Get Platform Stats
```bash
aptos move view \
    --function-id <CONTRACT_ADDRESS>::access_control::get_platform_config
```

## 🔗 Frontend Integration

Copy `integration.ts` to your frontend project and update the contract address:

```typescript
import { TrendPupAccessControl, CONTRACT_CONFIG } from './integration';

// Update contract address after deployment
CONTRACT_CONFIG.CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";

const accessControl = new TrendPupAccessControl();

// Check user access
const hasAccess = await accessControl.hasAccess(userAddress);

// Purchase access
const txHash = await accessControl.purchaseAccess(userAccount);
```

## 🧪 Testing

Run contract tests:

```bash
cd contract
aptos move test
```

Test specific functions:

```bash
aptos move test --filter test_purchase_access
```

## 📊 Contract Events

The contract emits events for:

- **AccessGrantedEvent** - When user purchases access
- **AccessRevokedEvent** - When admin revokes access
- **ConfigUpdatedEvent** - When admin updates configuration

## 🛡️ Security Features

- **Access expiration** - Automatic time-based access control
- **Payment verification** - Ensures proper APT payment
- **Admin controls** - Owner-only administrative functions
- **Emergency revocation** - Admin can revoke access if needed
- **Treasury management** - Secure fee collection and withdrawal

## 🔄 Upgrade Process

To update the contract:

1. Modify the source code
2. Update version in `Move.toml`
3. Run deployment script again
4. Update frontend with new contract address

## 📝 Notes

- Contract is deployed on Aptos testnet by default
- Change `NETWORK=mainnet` in deployment script for mainnet
- Treasury address can be different from deployer address
- Access duration is calculated in seconds (30 days = 2,592,000 seconds)
- All monetary amounts are in octas (1 APT = 100,000,000 octas)

## 🐛 Troubleshooting

### Common Issues

1. **"Insufficient balance"** - Ensure account has enough APT
2. **"Already has access"** - User already has active access
3. **"Not authorized"** - Only contract owner can perform admin functions
4. **"Access expired"** - User needs to purchase access again

### Get Help

Check account balance:
```bash
aptos account list --query balance
```

Fund testnet account:
```bash
aptos account fund-with-faucet
```

View transaction details:
```bash
aptos transaction show --transaction-hash <TX_HASH>
```

## 🌟 Next Steps

After deployment:

1. Update frontend `CONTRACT_CONFIG.CONTRACT_ADDRESS`
2. Test access purchase flow
3. Integrate with existing authentication system
4. Set up monitoring for contract events
5. Configure treasury withdrawal schedule

---

**TrendPup** - Democratizing memecoin intelligence on Aptos with smart contract access control.
