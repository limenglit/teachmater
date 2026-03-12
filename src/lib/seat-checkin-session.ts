import { supabase } from '@/integrations/supabase/client';

interface CreateSeatCheckinSessionParams {
  seatData: unknown;
  studentNames: string[];
  sceneConfig: Record<string, unknown>;
  sceneType: string;
}

export async function createSeatCheckinSession({
  seatData,
  studentNames,
  sceneConfig,
  sceneType,
}: CreateSeatCheckinSessionParams) {
  const insertData = {
    seat_data: JSON.parse(JSON.stringify(seatData)),
    student_names: JSON.parse(JSON.stringify(studentNames)),
    scene_config: JSON.parse(JSON.stringify(sceneConfig)),
    scene_type: sceneType,
  };

  const { data, error } = await supabase
    .from('seat_checkin_sessions')
    .insert([insertData])
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create seat checkin session');
  }

  return {
    sessionId: data.id,
    checkinUrl: `${window.location.origin}/seat-checkin/${data.id}`,
  };
}
