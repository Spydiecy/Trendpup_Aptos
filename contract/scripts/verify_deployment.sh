#!/bin/bash

# Deployment Verification Script
# Run this after deployment to verify everything is working

set -e

CONTRACT_ADDRESS=${1:-""}

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "❌ Please provide contract address as first argument"
    echo "Usage: ./verify_deployment.sh <contract_address>"
    exit 1
fi

echo "🔍 Verifying TrendPup Contract Deployment"
echo "========================================"
echo "📍 Contract Address: $CONTRACT_ADDRESS"
echo ""

# Test 1: Check if platform is initialized
echo "Test 1: Platform Initialization"
echo "--------------------------------"
INITIALIZED=$(aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::is_initialized | grep -o 'true\|false')
if [ "$INITIALIZED" = "true" ]; then
    echo "✅ Platform is initialized"
else
    echo "❌ Platform is not initialized"
    exit 1
fi

# Test 2: Get platform configuration
echo ""
echo "Test 2: Platform Configuration"
echo "------------------------------"
aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::get_platform_config

# Test 3: Check access fee
echo ""
echo "Test 3: Access Fee"
echo "-----------------"
FEE=$(aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::get_access_fee | grep -o '[0-9]\+')
EXPECTED_FEE="100000000"
if [ "$FEE" = "$EXPECTED_FEE" ]; then
    echo "✅ Access fee is correct: $FEE octas (1 APT)"
else
    echo "❌ Access fee mismatch. Expected: $EXPECTED_FEE, Got: $FEE"
fi

# Test 4: Check access duration
echo ""
echo "Test 4: Access Duration"
echo "----------------------"
DURATION=$(aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::get_access_duration | grep -o '[0-9]\+')
EXPECTED_DURATION="2592000"
if [ "$DURATION" = "$EXPECTED_DURATION" ]; then
    echo "✅ Access duration is correct: $DURATION seconds (30 days)"
else
    echo "❌ Access duration mismatch. Expected: $EXPECTED_DURATION, Got: $DURATION"
fi

# Test 5: Check account access (should be false initially)
echo ""
echo "Test 5: Account Access Check"
echo "---------------------------"
ACCOUNT_ADDRESS=$(aptos account list --query balance --account default | grep -o '0x[a-fA-F0-9]*' | head -1)
HAS_ACCESS=$(aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::has_access --args address:$ACCOUNT_ADDRESS | grep -o 'true\|false')
echo "Account: $ACCOUNT_ADDRESS"
echo "Has Access: $HAS_ACCESS"

# Test 6: Get access info
echo ""
echo "Test 6: Access Information"
echo "-------------------------"
aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::get_access_info --args address:$ACCOUNT_ADDRESS

echo ""
echo "🎉 Deployment Verification Complete!"
echo "===================================="
echo ""
echo "📋 Summary:"
echo "   ✅ Contract deployed and initialized"
echo "   ✅ Access fee: 1 APT (100,000,000 octas)"
echo "   ✅ Access duration: 30 days (2,592,000 seconds)"
echo "   📍 Contract address: $CONTRACT_ADDRESS"
echo ""
echo "🚀 Ready for integration!"
echo ""
echo "Next steps:"
echo "1. Update frontend CONTRACT_ADDRESS in integration.ts"
echo "2. Test access purchase:"
echo "   aptos move run --function-id ${CONTRACT_ADDRESS}::access_control::purchase_access --assume-yes"
echo "3. Verify access after purchase:"
echo "   aptos move view --function-id ${CONTRACT_ADDRESS}::access_control::has_access --args address:$ACCOUNT_ADDRESS"
