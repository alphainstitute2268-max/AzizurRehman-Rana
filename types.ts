
export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  imagePrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface GeneratedImageRecord {
  timestamp: number;
  imageUrl: string;
  prompt: string;
  sceneTitle: string;
  sceneNumber: number;
  style: string;
}

export interface ScriptAnalysis {
  projectTitle: string;
  projectStyle: string;
  scenes: Scene[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface UserSettings {
  generatedImageCount: number;
}
