import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import GroupManager from './GroupManager';
import TeamBuilder from './TeamBuilder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TeamworkPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'groups' | 'teams'>('groups');

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'groups' | 'teams')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
          <TabsTrigger value="groups" className="gap-1.5">
            <span>📊</span>
            <span>{t('tab.groups')}</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <span>⚡</span>
            <span>{t('tab.teams')}</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="groups" className="mt-0">
          <GroupManager />
        </TabsContent>
        
        <TabsContent value="teams" className="mt-0">
          <TeamBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
