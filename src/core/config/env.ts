/**
 * Environment Configuration
 * Centralized configuration management with type safety
 */

export interface EnvironmentConfig {
  readonly app: {
    readonly name: string;
    readonly version: string;
    readonly environment: 'development' | 'staging' | 'production';
    readonly url: string;
  };
  readonly supabase: {
    readonly url: string;
    readonly anonKey: string;
  };
  readonly sentry: {
    readonly dsn?: string;
  };
  readonly features: {
    readonly enableSentry: boolean;
    readonly enableAnalytics: boolean;
    readonly enableServiceWorker: boolean;
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): EnvironmentConfig {
    return {
      app: {
        name: 'EchoVault',
        version: '1.0.0',
        environment: this.getEnvironment(),
        url: window.location.origin,
      },
      supabase: {
        url: 'https://wwaldqgsedruplukxqdf.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YWxkcWdzZWRydXBsdWt4cWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTU1MzUsImV4cCI6MjA2OTk3MTUzNX0.0E4SCTmtaoFO6CaNIh4wLQJPyJWOsPCcSrfKzi8k-K0',
      },
      sentry: {
        dsn: import.meta.env.VITE_SENTRY_DSN,
      },
      features: {
        enableSentry: this.getEnvironment() === 'production',
        enableAnalytics: this.getEnvironment() !== 'development',
        enableServiceWorker: this.getEnvironment() === 'production',
      },
    };
  }

  private getEnvironment(): 'development' | 'staging' | 'production' {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
    
    if (hostname.includes('staging') || hostname.includes('preview')) {
      return 'staging';
    }
    
    return 'production';
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public get<K extends keyof EnvironmentConfig>(section: K): EnvironmentConfig[K] {
    return this.config[section];
  }
}

export const config = ConfigManager.getInstance().getConfig();
export const getConfig = () => ConfigManager.getInstance().getConfig();