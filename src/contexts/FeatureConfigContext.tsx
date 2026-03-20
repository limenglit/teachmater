import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TabId } from '@/components/TabNavigation';
import { setSystemRequireSeatAssignmentBeforeCheckin } from '@/lib/seat-checkin-policy';

export interface FeatureFlags {
  random: boolean;
  teamwork: boolean;
  seats: boolean;
  board: boolean;
  quiz: boolean;
  sketch: boolean;
  ppt: boolean;
  visual: boolean;
  achieve: boolean;
  toolkit: boolean;
  ai_daily_limit: number; // -1 = unlimited
}

export interface SystemConfig {
  guest: FeatureFlags;
  registered: FeatureFlags;
  checkinPolicy: {
    require_seat_assignment_before_checkin: boolean;
  };
}

const DEFAULT_CONFIG: SystemConfig = {
  guest: {
    random: true, teamwork: true, seats: true, board: true, quiz: true,
    sketch: true, ppt: true, visual: true, achieve: true, toolkit: true,
    ai_daily_limit: 5,
  },
  registered: {
    random: true, teamwork: true, seats: true, board: true, quiz: true,
    sketch: true, ppt: true, visual: true, achieve: true, toolkit: true,
    ai_daily_limit: -1,
  },
  checkinPolicy: {
    require_seat_assignment_before_checkin: true,
  },
};

interface FeatureConfigContextType {
  config: SystemConfig;
  loading: boolean;
  isFeatureVisible: (tabId: TabId) => boolean;
  getAIDailyLimit: () => number;
  reloadConfig: () => Promise<void>;
}

const FeatureConfigContext = createContext<FeatureConfigContextType>({
  config: DEFAULT_CONFIG,
  loading: true,
  isFeatureVisible: () => true,
  getAIDailyLimit: () => 5,
  reloadConfig: async () => {},
});

export function FeatureConfigProvider({ children }: { children: ReactNode }) {
  const { user, approvalStatus } = useAuth();
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config' as any)
        .select('config')
        .limit(1)
        .single();
      if (!error && data) {
        const raw = (data as any).config;
        if (raw && typeof raw === 'object' && raw.guest && raw.registered) {
          const nextConfig = {
            guest: { ...DEFAULT_CONFIG.guest, ...raw.guest },
            registered: { ...DEFAULT_CONFIG.registered, ...raw.registered },
            checkinPolicy: {
              ...DEFAULT_CONFIG.checkinPolicy,
              ...((raw as any).checkinPolicy || {}),
            },
          };

          setConfig(nextConfig);
          setSystemRequireSeatAssignmentBeforeCheckin(nextConfig.checkinPolicy.require_seat_assignment_before_checkin);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Use defaults
    }
    setSystemRequireSeatAssignmentBeforeCheckin(DEFAULT_CONFIG.checkinPolicy.require_seat_assignment_before_checkin);
    setLoading(false);
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const isRegistered = !!user && approvalStatus === 'approved';
  const userType = isRegistered ? 'registered' : 'guest';

  const isFeatureVisible = (tabId: TabId): boolean => {
    const flags = config[userType];
    return flags[tabId] !== false;
  };

  const getAIDailyLimit = (): number => {
    return config[userType].ai_daily_limit;
  };

  return (
    <FeatureConfigContext.Provider value={{ config, loading, isFeatureVisible, getAIDailyLimit, reloadConfig: loadConfig }}>
      {children}
    </FeatureConfigContext.Provider>
  );
}

export function useFeatureConfig() {
  return useContext(FeatureConfigContext);
}
