
import { GoogleGenAI, Type } from "@google/genai";
import { Scene } from "../types";

export const suggestStyleFromTopic = async (topic: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the movie/script topic "${topic}", suggest a professional cinematic visual style. 
    Avoid "animated" or "cartoonish" styles. 
    If the topic suggests history, war, or struggle, recommend styles like "Raw, desaturated 35mm documentary realism" or "High-contrast gritty historical noir". 
    Return ONLY the style name.`,
  });
  return response.text?.trim() || "Cinematic, high-fidelity, photorealistic";
};

export const parseScript = async (
  scriptText: string, 
  topic: string, 
  style: string, 
  frameCount: number = 24
): Promise<{ projectTitle: string; projectStyle: string; scenes: Scene[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Using Gemini 3 Pro for superior reasoning and historical/emotional context comprehension.
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `You are a world-class Storyboard Director, Historian, and Narrative Specialist. 
    Analyze the project titled "${topic}" and divide it into exactly ${frameCount} key visual beats.

    MANDATORY VISUAL DIRECTIVES:
    1. UNDERSTANDING CONTEXT: If the script involves prisoners, famine, war, or poverty, YOU MUST REFLECT THE REALITY OF SUFFERING. 
    2. CHARACTER APPEARANCE: Characters must NOT look "healthy", "clean", or "Hollywood-polished". If they are prisoners, describe them as: emaciated, malnourished, covered in realistic grime and coal dust, eyes sunken, skin sallow and weathered, hair matted and thinning. Clothing must be tattered, ill-fitting, and stained with historical filth.
    3. ENVIRONMENT: Avoid clean sets. Describe environments with authentic grit: rust, mud, harsh shadows, claustrophobic framing, and period-accurate squalor.
    4. NO ANIMATION: Prompts are for RAW PHOTOGRAPHIC STILLS.
    5. STYLE: Strictly adhere to the requested style "${style}" but filter it through a lens of historical authenticity and grit.

    SCRIPT CONTENT:
    ${scriptText.substring(0, 50000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectTitle: { type: Type.STRING },
          projectStyle: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                sceneNumber: { type: Type.INTEGER },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["id", "sceneNumber", "title", "description", "imagePrompt"]
            }
          }
        },
        required: ["projectTitle", "projectStyle", "scenes"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from script analyzer.");
  return JSON.parse(text);
};

export const generateSceneImage = async (prompt: string, seed?: number): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // We use very aggressive negative prompting inside the positive prompt to force the model away from its 'beauty' bias.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ 
        text: `AUTHENTIC HISTORICAL PHOTOGRAPH. 
               DIRECTIVE: ABSOLUTELY NO CLEAN SKIN. NO HEALTHY GLOW. NO PERFECT TEETH. NO POLISHED HAIR.
               SUBJECTS: Must look physically exhausted, dirty, malnourished, and distressed. Emphasize raw textures, mud, dust, and sallow skin tones. 
               STYLE: RAW CINEMATIC REALISM, 35mm grain, heavy atmospheric shadows.
               
               DETAILED SCENE: ${prompt}` 
      }],
    },
    config: {
      seed: seed || Math.floor(Math.random() * 1000000),
      imageConfig: {
        aspectRatio: "16:9"
      }
    },
  });

  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("Safety filters blocked the image or API error.");

  for (const part of candidate.content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  const textRefusal = candidate.content.parts.find(p => p.text);
  if (textRefusal) throw new Error(`Model Refused: ${textRefusal.text}`);
  
  throw new Error("No image data returned from Gemini.");
};
