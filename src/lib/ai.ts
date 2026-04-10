import { GoogleGenAI } from "@google/genai";

export let ai: GoogleGenAI;

export const initAI = (apiKey: string) => {
  ai = new GoogleGenAI({ 
    apiKey: apiKey,
    apiVersion: 'v1alpha'
  });
};
