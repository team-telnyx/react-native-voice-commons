import {
  CredentialConfig,
  TokenConfig,
  isCredentialConfig,
  isTokenConfig,
  validateCredentialConfig,
  validateTokenConfig,
  validateConfig,
  createCredentialConfig,
  createTokenConfig,
} from '../../src/models/config';

describe('Config Models', () => {
  describe('Type Guards', () => {
    it('should correctly identify credential config', () => {
      const credConfig: CredentialConfig = {
        type: 'credential',
        sipUser: 'user',
        sipPassword: 'pass',
      };

      expect(isCredentialConfig(credConfig)).toBe(true);
      expect(isTokenConfig(credConfig)).toBe(false);
    });

    it('should correctly identify token config', () => {
      const tokenConfig: TokenConfig = {
        type: 'token',
        token: 'abc123',
      };

      expect(isTokenConfig(tokenConfig)).toBe(true);
      expect(isCredentialConfig(tokenConfig)).toBe(false);
    });
  });

  describe('Validation', () => {
    describe('validateCredentialConfig', () => {
      it('should pass validation for valid config', () => {
        const config: CredentialConfig = {
          type: 'credential',
          sipUser: 'user',
          sipPassword: 'pass',
        };

        expect(validateCredentialConfig(config)).toEqual([]);
      });

      it('should fail validation for missing sipUser', () => {
        const config: CredentialConfig = {
          type: 'credential',
          sipUser: '',
          sipPassword: 'pass',
        };

        const errors = validateCredentialConfig(config);
        expect(errors).toContain('sipUser is required');
      });

      it('should fail validation for missing sipPassword', () => {
        const config: CredentialConfig = {
          type: 'credential',
          sipUser: 'user',
          sipPassword: '',
        };

        const errors = validateCredentialConfig(config);
        expect(errors).toContain('sipPassword is required');
      });
    });

    describe('validateTokenConfig', () => {
      it('should pass validation for valid config', () => {
        const config: TokenConfig = {
          type: 'token',
          token: 'abc123',
        };

        expect(validateTokenConfig(config)).toEqual([]);
      });

      it('should fail validation for missing token', () => {
        const config: TokenConfig = {
          type: 'token',
          token: '',
        };

        const errors = validateTokenConfig(config);
        expect(errors).toContain('token is required');
      });
    });

    describe('validateConfig', () => {
      it('should validate credential config', () => {
        const config: CredentialConfig = {
          type: 'credential',
          sipUser: 'user',
          sipPassword: 'pass',
        };

        expect(validateConfig(config)).toEqual([]);
      });

      it('should validate token config', () => {
        const config: TokenConfig = {
          type: 'token',
          token: 'abc123',
        };

        expect(validateConfig(config)).toEqual([]);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createCredentialConfig', () => {
      it('should create basic credential config', () => {
        const config = createCredentialConfig('user', 'pass');

        expect(config).toEqual({
          type: 'credential',
          sipUser: 'user',
          sipPassword: 'pass',
        });
      });

      it('should create credential config with options', () => {
        const config = createCredentialConfig('user', 'pass', {
          sipCallerIDName: 'Test User',
          debug: true,
        });

        expect(config).toEqual({
          type: 'credential',
          sipUser: 'user',
          sipPassword: 'pass',
          sipCallerIDName: 'Test User',
          debug: true,
        });
      });
    });

    describe('createTokenConfig', () => {
      it('should create basic token config', () => {
        const config = createTokenConfig('abc123');

        expect(config).toEqual({
          type: 'token',
          token: 'abc123',
        });
      });

      it('should create token config with options', () => {
        const config = createTokenConfig('abc123', {
          sipCallerIDName: 'Test User',
          debug: true,
        });

        expect(config).toEqual({
          type: 'token',
          token: 'abc123',
          sipCallerIDName: 'Test User',
          debug: true,
        });
      });
    });
  });
});
