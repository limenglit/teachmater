import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TabId } from '@/components/TabNavigation';
import { setSystemRequireSeatAssignmentBeforeCheckin } from '@/lib/seat-checkin-policy';
import type { ToolkitToolFlags, ToolkitToolId } from '@/components/AdminToolkitConfigPanel';
import { DEFAULT_TOOLKIT_TOOLS } from '@/components/AdminToolkitConfigPanel';

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
  community: boolean;
  toolkit: boolean;
  ai_daily_limit: number; // -1 = unlimited
}

export interface SystemConfig {
  guest: FeatureFlags;
  registered: FeatureFlags;
  checkinPolicy: {
    require_seat_assignment_before_checkin: boolean;
  };
  toolkitTools: {
    guest: ToolkitToolFlags;
    registered: ToolkitToolFlags;
  };
}

const DEFAULT_CONFIG: SystemConfig = {
  guest: {
    random: true, teamwork: true, seats: true, board: true, quiz: true,
    sketch: true, ppt: true, visual: true, achieve: true, community: true, toolkit: true,
    ai_daily_limit: 5,
  },
  registered: {
    random: true, teamwork: true, seats: true, board: true, quiz: true,
    sketch: true, ppt: true, visual: true, achieve: true, community: true, toolkit: true,
    ai_daily_limit: -1,
  },
  checkinPolicy: {
    require_seat_assignment_before_checkin: true,
  },
  toolkitTools: {
    guest: { ...DEFAULT_TOOLKIT_TOOLS },
    registered: { ...DEFAULT_TOOLKIT_TOOLS },
  },
};

interface FeatureConfigContextType {
  config: SystemConfig;
  loading: boolean;
  isFeatureVisible: (tabId: TabId) => boolean;
  getAIDailyLimit: () => number;
  isToolkitToolVisible: (toolId: ToolkitToolId) => boolean;
  reloadConfig: () => Promise<void>;
}

const FeatureConfigContext = createContext<FeatureConfigContextType>({
  config: DEFAULT_CONFIG,
  loading: true,
  isFeatureVisible: () => true,
  getAIDailyLimit: () => 5,
  isToolkitToolVisible: () => true,
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
          const nextConfig: SystemConfig = {
            guest: { ...DEFAULT_CONFIG.guest, ...raw.guest },
            registered: { ...DEFAULT_CONFIG.registered, ...raw.registered },
            checkinPolicy: {
              ...DEFAULT_CONFIG.checkinPolicy,
              ...((raw as any).checkinPolicy || {}),
            },
            toolkitTools: {
              guest: { ...DEFAULT_TOOLKIT_TOOLS, ...((raw as any).toolkitTools?.guest || {}) },
              registered: { ...DEFAULT_TOOLKIT_TOOLS, ...((raw as any).toolkitTools?.registered || {}) },
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
    if (isAdmin) return -1; // admins are never rate-limited
    return config[userType].ai_daily_limit;
  };

  const isToolkitToolVisible = (toolId: ToolkitToolId): boolean => {
    return config.toolkitTools[userType][toolId] !== false;
  };

  return (
    <FeatureConfigContext.Provider value={{ config, loading, isFeatureVisible, getAIDailyLimit, isToolkitToolVisible, reloadConfig: loadConfig }}>
      {children}
    </FeatureConfigContext.Provider>
  );
}

export function useFeatureConfig() {
  return useContext(FeatureConfigContext);
}
