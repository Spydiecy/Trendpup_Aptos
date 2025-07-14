#!/bin/bash

# TrendPup Contract Interaction Script
# Use this to test contract functions after deployment

set -e

CONTRACT_ADDRESS=${1:-""}

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "❌ Please provide contract address as first argument"
    echo "Usage: ./test_contract.sh <contract_address>"
    exit 1
fi

echo "🧪 Testing TrendPup Access Control Contract"
echo "=========================================="
echo "📍 Contract Address: $CONTRACT_ADDRESS"

# Check if platform is initialized
echo "🔍 Checking if platform is initialized..."
aptos move view \
    --function-id ${CONTRACT_ADDRESS}::access_control::is_initialized

# Get platform configuration
echo "🔍 Getting platform configuration..."
aptos move view \
    --function-id ${CONTRACT_ADDRESS}::access_control::get_platform_config

# Get access fee
echo "🔍 Getting access fee..."
aptos move view \
    --function-id ${CONTRACT_ADDRESS}::access_control::get_access_fee

# Get access duration
echo "🔍 Getting access duration..."
aptos move view \
    --function-id ${CONTRACT_ADDRESS}::access_control::get_access_duration

# Get current account address
ACCOUNT_ADDRESS=$(aptos account list --query balance --account default | grep -o '0x[a-fA-F0-9]*' | head -1)

# Check if current account has access
echo "🔍 Checking access for account: $ACCOUNT_ADDRESS"
aptos move view \
    --function-id ${CONTRACT_ADDRESS}::access_control::has_access \
    --args address:$ACCOUNT_ADDRESS

# Get access info for current account
echo "🔍 Getting access info for account: $ACCOUNT_ADDRESS"
aptos move view \
    --function-id ${CONTRACT_ADDRESS}::access_control::get_access_info \
    --args address:$ACCOUNT_ADDRESS

echo ""
echo "💰 To purchase access, run:"
echo "aptos move run --function-id ${CONTRACT_ADDRESS}::access_control::purchase_access --assume-yes"
echo ""
echo "🔍 To check access after purchase:"
echo "aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::has_access --args address:$ACCOUNT_ADDRESS"
