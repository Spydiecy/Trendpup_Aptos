/// TrendPup Access Control Contract
/// Manages premium access to TrendPup AI memecoin intelligence platform
/// Users pay 1 APT to gain access to the system

module trendpup_access::access_control {
    use std::signer;
    use std::error;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_PAYMENT: u64 = 2;
    const E_ALREADY_HAS_ACCESS: u64 = 3;
    const E_ACCESS_EXPIRED: u64 = 4;
    const E_INVALID_DURATION: u64 = 5;

    /// Constants
    const ACCESS_FEE: u64 = 100000000; // 1 APT (1 * 10^8 octas)
    const DEFAULT_ACCESS_DURATION: u64 = 2592000; // 30 days in seconds

    /// Access record for a user
    struct AccessRecord has key, store {
        is_active: bool,
        expiration_time: u64,
        payment_amount: u64,
        granted_at: u64,
    }

    /// Platform configuration and treasury
    struct PlatformConfig has key {
        owner: address,
        treasury: address,
        access_fee: u64,
        access_duration: u64,
        total_users: u64,
        total_revenue: u64,
    }

    /// Events
    #[event]
    struct AccessGrantedEvent has drop, store {
        user: address,
        payment_amount: u64,
        expiration_time: u64,
        timestamp: u64,
    }

    #[event]
    struct AccessRevokedEvent has drop, store {
        user: address,
        timestamp: u64,
    }

    #[event]
    struct ConfigUpdatedEvent has drop, store {
        new_fee: u64,
        new_duration: u64,
        timestamp: u64,
    }

    /// Initialize the platform (called once by the deployer)
    public entry fun initialize(
        account: &signer,
        treasury: address,
    ) {
        let account_addr = signer::address_of(account);
        
        // Create platform configuration
        move_to(account, PlatformConfig {
            owner: account_addr,
            treasury,
            access_fee: ACCESS_FEE,
            access_duration: DEFAULT_ACCESS_DURATION,
            total_users: 0,
            total_revenue: 0,
        });
    }

    /// Purchase access to the TrendPup platform
    public entry fun purchase_access(user: &signer) acquires PlatformConfig, AccessRecord {
        let user_addr = signer::address_of(user);
        let config = borrow_global_mut<PlatformConfig>(@trendpup_access);
        
        // Check if user already has active access
        if (exists<AccessRecord>(user_addr)) {
            let access_record = borrow_global<AccessRecord>(user_addr);
            assert!(!is_access_active(access_record), error::already_exists(E_ALREADY_HAS_ACCESS));
        };

        // Transfer payment from user to treasury
        coin::transfer<AptosCoin>(user, config.treasury, config.access_fee);

        // Calculate expiration time
        let current_time = timestamp::now_seconds();
        let expiration_time = current_time + config.access_duration;

        // Grant or update access
        if (exists<AccessRecord>(user_addr)) {
            let access_record = borrow_global_mut<AccessRecord>(user_addr);
            access_record.is_active = true;
            access_record.expiration_time = expiration_time;
            access_record.payment_amount = config.access_fee;
            access_record.granted_at = current_time;
        } else {
            move_to(user, AccessRecord {
                is_active: true,
                expiration_time,
                payment_amount: config.access_fee,
                granted_at: current_time,
            });
            config.total_users = config.total_users + 1;
        };

        // Update revenue
        config.total_revenue = config.total_revenue + config.access_fee;

        // Emit event
        event::emit(AccessGrantedEvent {
            user: user_addr,
            payment_amount: config.access_fee,
            expiration_time,
            timestamp: current_time,
        });
    }

    /// Check if a user has active access
    #[view]
    public fun has_access(user_addr: address): bool acquires AccessRecord {
        if (!exists<AccessRecord>(user_addr)) {
            return false
        };
        
        let access_record = borrow_global<AccessRecord>(user_addr);
        is_access_active(access_record)
    }

    /// Internal function to check if access record is active
    fun is_access_active(access_record: &AccessRecord): bool {
        access_record.is_active && timestamp::now_seconds() < access_record.expiration_time
    }

    /// Get user's access information
    #[view]
    public fun get_access_info(user_addr: address): (bool, u64, u64, u64) acquires AccessRecord {
        if (!exists<AccessRecord>(user_addr)) {
            return (false, 0, 0, 0)
        };
        
        let access_record = borrow_global<AccessRecord>(user_addr);
        (
            is_access_active(access_record),
            access_record.expiration_time,
            access_record.payment_amount,
            access_record.granted_at
        )
    }

    /// Get platform configuration
    #[view]
    public fun get_platform_config(): (address, address, u64, u64, u64, u64) acquires PlatformConfig {
        let config = borrow_global<PlatformConfig>(@trendpup_access);
        (
            config.owner,
            config.treasury,
            config.access_fee,
            config.access_duration,
            config.total_users,
            config.total_revenue
        )
    }

    /// Admin function to update access fee and duration
    public entry fun update_config(
        admin: &signer,
        new_fee: u64,
        new_duration: u64,
    ) acquires PlatformConfig {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global_mut<PlatformConfig>(@trendpup_access);
        
        // Only owner can update config
        assert!(admin_addr == config.owner, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(new_duration > 0, error::invalid_argument(E_INVALID_DURATION));

        config.access_fee = new_fee;
        config.access_duration = new_duration;

        // Emit event
        event::emit(ConfigUpdatedEvent {
            new_fee,
            new_duration,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Admin function to revoke user access (for emergencies)
    public entry fun revoke_access(
        admin: &signer,
        user_addr: address,
    ) acquires PlatformConfig, AccessRecord {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global<PlatformConfig>(@trendpup_access);
        
        // Only owner can revoke access
        assert!(admin_addr == config.owner, error::permission_denied(E_NOT_AUTHORIZED));
        assert!(exists<AccessRecord>(user_addr), error::not_found(E_ACCESS_EXPIRED));

        let access_record = borrow_global_mut<AccessRecord>(user_addr);
        access_record.is_active = false;

        // Emit event
        event::emit(AccessRevokedEvent {
            user: user_addr,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Admin function to withdraw treasury funds
    public entry fun withdraw_treasury(
        admin: &signer,
        amount: u64,
    ) acquires PlatformConfig {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global<PlatformConfig>(@trendpup_access);
        
        // Only owner can withdraw
        assert!(admin_addr == config.owner, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Transfer from treasury to admin
        coin::transfer<AptosCoin>(admin, admin_addr, amount);
    }

    /// View function to get current access fee
    #[view]
    public fun get_access_fee(): u64 acquires PlatformConfig {
        let config = borrow_global<PlatformConfig>(@trendpup_access);
        config.access_fee
    }

    /// View function to get access duration
    #[view]
    public fun get_access_duration(): u64 acquires PlatformConfig {
        let config = borrow_global<PlatformConfig>(@trendpup_access);
        config.access_duration
    }

    /// View function to check if platform is initialized
    #[view]
    public fun is_initialized(): bool {
        exists<PlatformConfig>(@trendpup_access)
    }

    #[test_only]
    use aptos_framework::account::create_account_for_test;
    
    #[test(admin = @trendpup_access, user = @0x123, treasury = @0x456)]
    public fun test_purchase_access(admin: signer, user: signer, treasury: signer) acquires PlatformConfig, AccessRecord {
        // Setup test environment
        timestamp::set_time_has_started_for_testing(&admin);
        let admin_addr = signer::address_of(&admin);
        let user_addr = signer::address_of(&user);
        let treasury_addr = signer::address_of(&treasury);
        
        create_account_for_test(admin_addr);
        create_account_for_test(user_addr);
        create_account_for_test(treasury_addr);
        
        // Initialize platform
        initialize(&admin, treasury_addr);
        
        // Give user some APT for testing
        coin::register<AptosCoin>(&user);
        coin::register<AptosCoin>(&treasury);
        
        // Test access purchase
        purchase_access(&user);
        
        // Verify access
        assert!(has_access(user_addr), 1);
        let (is_active, _, _, _) = get_access_info(user_addr);
        assert!(is_active, 2);
    }
}
