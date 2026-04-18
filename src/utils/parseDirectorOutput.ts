// utils/parseDirectorOutput.ts

/**
 * Frame update recommendation from the AI Director
 */
export interface FrameUpdate {
  frame_id: string;
  recommended_duration_ms: number;
  recommended_animation_style: string;
  confidence: number;
  reason: string;
}

/**
 * Parsed director output structure
 */
export interface DirectorOutput {
  storyboard_analysis: {
    board_id: string;
    total_frames: number;
    narrative: string;
  };
  external_summary: {
    pacing_trends: string[];
    sources: string[];
  };
  decisions: {
    frame_updates: FrameUpdate[];
  };
  optimization_score: number;
}

/**
 * Clean and parse the stored director output
 * Handles double-encoded strings and markdown code blocks
 */
export const parseDirectorOutput = (rawOutput: string): DirectorOutput | null => {
  try {
    // Step 1: If it's double-encoded (string within string), parse once
    let parsed = rawOutput;
    if (parsed.startsWith('"') && parsed.endsWith('"')) {
      parsed = JSON.parse(parsed);
    }

    // Step 2: Remove markdown code blocks
    parsed = parsed
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    // Step 3: Parse the actual JSON
    return JSON.parse(parsed);
  } catch (error) {
    console.error('Failed to parse director output:', error);
    return null;
  }
};

/**
 * Fetch the latest director results for a board from Supabase
 */
export const fetchDirectorResults = async (
  supabase: any,
  boardId: string
): Promise<DirectorOutput | null> => {
  try {
    const { data, error } = await supabase
      .from('director_runs')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('No director results found:', error);
      return null;
    }

    const parsed = parseDirectorOutput(data.agent_output);

    if (parsed) {
      console.log('Optimization Score:', parsed.optimization_score);
      console.log('Frame Updates:', parsed.decisions.frame_updates);
      console.log('Narrative:', parsed.storyboard_analysis.narrative);
    }

    return parsed;
  } catch (error) {
    console.error('Error fetching director results:', error);
    return null;
  }
};
