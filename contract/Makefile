# TrendPup Contract Makefile
# Provides convenient commands for contract management

.PHONY: help install compile test deploy verify clean fund

# Default target
help:
	@echo "🐕 TrendPup Access Control Contract"
	@echo "=================================="
	@echo ""
	@echo "Available commands:"
	@echo "  make install   - Install Aptos CLI"
	@echo "  make compile   - Compile the contract"
	@echo "  make test      - Run contract tests"
	@echo "  make deploy    - Deploy contract to testnet"
	@echo "  make verify    - Verify deployment (requires CONTRACT_ADDRESS)"
	@echo "  make fund      - Fund account from faucet (testnet only)"
	@echo "  make clean     - Clean build artifacts"
	@echo ""
	@echo "Environment variables:"
	@echo "  NETWORK=testnet|mainnet (default: testnet)"
	@echo "  CONTRACT_ADDRESS=<address> (for verify command)"
	@echo ""
	@echo "Examples:"
	@echo "  make deploy NETWORK=testnet"
	@echo "  make verify CONTRACT_ADDRESS=0x123..."

# Install Aptos CLI
install:
	@echo "📦 Installing Aptos CLI..."
	curl -fsSL https://aptos.dev/scripts/install_cli.py | python3
	@echo "✅ Installation complete. Run 'aptos --version' to verify."

# Compile the contract
compile:
	@echo "🔨 Compiling contract..."
	aptos move compile
	@echo "✅ Compilation complete."

# Run tests
test:
	@echo "🧪 Running tests..."
	aptos move test
	@echo "✅ Tests passed."

# Deploy contract
deploy:
	@echo "🚀 Deploying contract..."
	@if [ ! -f "scripts/deploy.sh" ]; then \
		echo "❌ Deploy script not found. Make sure you're in the contract directory."; \
		exit 1; \
	fi
	NETWORK=$(or $(NETWORK),testnet) ./scripts/deploy.sh
	@echo "✅ Deployment complete."

# Verify deployment
verify:
	@if [ -z "$(CONTRACT_ADDRESS)" ]; then \
		echo "❌ CONTRACT_ADDRESS not set. Usage: make verify CONTRACT_ADDRESS=0x123..."; \
		exit 1; \
	fi
	@echo "🔍 Verifying deployment..."
	./scripts/verify_deployment.sh $(CONTRACT_ADDRESS)

# Fund account from faucet (testnet only)
fund:
	@echo "💰 Funding account from faucet..."
	aptos account fund-with-faucet --account default
	@echo "✅ Account funded."

# Test contract functions
test-contract:
	@if [ -z "$(CONTRACT_ADDRESS)" ]; then \
		echo "❌ CONTRACT_ADDRESS not set. Usage: make test-contract CONTRACT_ADDRESS=0x123..."; \
		exit 1; \
	fi
	@echo "🧪 Testing contract functions..."
	./scripts/test_contract.sh $(CONTRACT_ADDRESS)

# Purchase access (for testing)
purchase-access:
	@if [ -z "$(CONTRACT_ADDRESS)" ]; then \
		echo "❌ CONTRACT_ADDRESS not set. Usage: make purchase-access CONTRACT_ADDRESS=0x123..."; \
		exit 1; \
	fi
	@echo "💳 Purchasing access..."
	aptos move run \
		--function-id $(CONTRACT_ADDRESS)::access_control::purchase_access \
		--assume-yes
	@echo "✅ Access purchased."

# Check access for current account
check-access:
	@if [ -z "$(CONTRACT_ADDRESS)" ]; then \
		echo "❌ CONTRACT_ADDRESS not set. Usage: make check-access CONTRACT_ADDRESS=0x123..."; \
		exit 1; \
	fi
	@ACCOUNT_ADDRESS=$$(aptos account list --query balance --account default | grep -o '0x[a-fA-F0-9]*' | head -1); \
	echo "🔍 Checking access for: $$ACCOUNT_ADDRESS"; \
	aptos move view \
		--function-id $(CONTRACT_ADDRESS)::access_control::has_access \
		--args address:$$ACCOUNT_ADDRESS

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf build/
	rm -f .aptos/config.yaml.bak
	rm -f Move.toml.bak
	@echo "✅ Clean complete."

# Show account info
account-info:
	@echo "📋 Account Information:"
	@echo "======================"
	aptos account list --query balance --account default

# Show platform stats
platform-stats:
	@if [ -z "$(CONTRACT_ADDRESS)" ]; then \
		echo "❌ CONTRACT_ADDRESS not set. Usage: make platform-stats CONTRACT_ADDRESS=0x123..."; \
		exit 1; \
	fi
	@echo "📊 Platform Statistics:"
	@echo "======================"
	aptos move view --function-id $(CONTRACT_ADDRESS)::access_control::get_platform_config

# Full deployment and verification workflow
deploy-full: compile test deploy
	@echo "🎉 Full deployment workflow complete!"
	@echo "Next: Run 'make verify CONTRACT_ADDRESS=<your_address>' to verify."
