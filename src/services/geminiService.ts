import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export enum Difficulty {
  BEGINNER = "Beginner",
  ADVANCED = "Advanced",
  EXPERT = "Expert"
}

export interface Question {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
  subject: string;
  type: string;
}

export interface AssessmentResult {
  score: number;
  total: number;
  feedback: {
    questionId: string;
    isCorrect: boolean;
    selectedAnswer: string;
    correctAnswer: string;
    explanation: string;
  }[];
  weakAreas: string[];
  recommendations: {
    topic: string;
    resources: { name: string; url: string }[];
  }[];
}

export async function generateQuestions(subjects: string[], difficulty: Difficulty, count: number = 10): Promise<Question[]> {
  const prompt = `Generate ${count} placement-oriented computer science multiple-choice questions for Indian engineering students.
  Subjects: ${subjects.join(", ")}
  Difficulty Level: ${difficulty}
  
  Question types should include: Theory, Code output, Debugging, and Logic-based questions.
  The questions should be challenging and relevant to software job interviews (TCS, Infosys, Wipro, FAANG, etc.).
  
  Return the response as a JSON array of objects.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: {
              type: Type.OBJECT,
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING },
                C: { type: Type.STRING },
                D: { type: Type.STRING },
              },
              required: ["A", "B", "C", "D"]
            },
            correctAnswer: { type: Type.STRING, description: "A, B, C, or D" },
            explanation: { type: Type.STRING },
            subject: { type: Type.STRING },
            type: { type: Type.STRING },
          },
          required: ["id", "text", "options", "correctAnswer", "explanation", "subject", "type"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse questions", e);
    return [];
  }
}

export async function analyzeGaps(results: AssessmentResult): Promise<AssessmentResult> {
  if (results.score === results.total) {
    return {
      ...results,
      weakAreas: [],
      recommendations: []
    };
  }

  const prompt = `Based on these test results:
  Score: ${results.score}/${results.total}
  Feedback: ${JSON.stringify(results.feedback)}
  
  Identify specific knowledge gaps and provide high-quality free learning recommendations (NPTEL, freeCodeCamp, Gate Smashers, etc.).
  Focus on placement readiness for Indian students.
  
  Return the response as JSON with "weakAreas" (string array) and "recommendations" (array of {topic, resources: [{name, url}]}).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weakAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                resources: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      url: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  try {
    const analysis = JSON.parse(response.text || "{}");
    return { ...results, ...analysis };
  } catch (e) {
    return results;
  }
}

export interface StudyNote {
  topic: string;
  content: string;
  keyPoints: string[];
}

export async function generateStudyNotes(subjects: string[]): Promise<StudyNote[]> {
  const prompt = `Generate concise, placement-oriented study notes for the following computer science subjects: ${subjects.join(", ")}.
  Focus on high-frequency interview topics for Indian engineering students.
  Provide 3-4 key topics with detailed but concise explanations and bulleted key points.
  
  Return the response as a JSON array of objects with "topic", "content", and "keyPoints" (string array).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            content: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["topic", "content", "keyPoints"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse study notes", e);
    return [];
  }
}

export interface DetailedSubjectInfo {
  subject: string;
  explanation: string;
  subTopics: { title: string; detail: string }[];
}

export async function generateDetailedInfo(subjects: string[]): Promise<DetailedSubjectInfo[]> {
  const prompt = `Provide in-depth, structured explanations for the following computer science subjects: ${subjects.join(", ")}.
  Focus on core concepts, architectural details, and advanced topics relevant for senior-level placement interviews.
  For each subject, provide a high-level explanation and a list of 3-5 critical sub-topics with detailed descriptions.
  
  Return the response as a JSON array of objects with "subject", "explanation", and "subTopics" (array of {title, detail}).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            explanation: { type: Type.STRING },
            subTopics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING }
                },
                required: ["title", "detail"]
              }
            }
          },
          required: ["subject", "explanation", "subTopics"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse detailed info", e);
    return [];
  }
}

export interface ExternalResource {
  platform: string;
  resources: { name: string; url: string; type: 'video' | 'article' | 'course' }[];
}

export async function getExternalResources(subjects: string[]): Promise<ExternalResource[]> {
  const prompt = `Provide high-quality external learning resources for the following computer science subjects: ${subjects.join(", ")}.
  Include resources from: NPTEL, Gate Smashers, freeCodeCamp, Abdul Bari (YouTube), GeeksforGeeks, Javatpoint, and W3Schools.
  Focus on resources that are highly effective for Indian engineering students preparing for placements.
  
  Return the response as a JSON array of objects with "platform" and "resources" (array of {name, url, type}).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            platform: { type: Type.STRING },
            resources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  url: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["video", "article", "course"] }
                },
                required: ["name", "url", "type"]
              }
            }
          },
          required: ["platform", "resources"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse external resources", e);
    return [];
  }
}

export interface CodingProblem {
  id: string;
  title: string;
  description: string;
  constraints: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
  initialCode: Record<string, string>;
  testCases: { input: string; expectedOutput: string }[];
}

export async function generateCodingProblems(subjects: string[], difficulty: Difficulty, count: number = 3): Promise<CodingProblem[]> {
  const prompt = `Generate ${count} coding problems for a competitive programming contest.
  Subjects: ${subjects.join(", ")}
  Difficulty: ${difficulty}
  
  Each problem should include:
  - title
  - description (Markdown)
  - constraints
  - inputFormat
  - outputFormat
  - sampleInput
  - sampleOutput
  - initialCode (a map of language to starter code, e.g., {"python": "def solution():\n    pass", "java": "public class Solution {\n    public static void main(String[] args) {\n    }\n}"})
  - testCases (at least 3 hidden test cases for evaluation)
  
  Return as a JSON array of objects.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            constraints: { type: Type.STRING },
            inputFormat: { type: Type.STRING },
            outputFormat: { type: Type.STRING },
            sampleInput: { type: Type.STRING },
            sampleOutput: { type: Type.STRING },
            initialCode: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
            testCases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  input: { type: Type.STRING },
                  expectedOutput: { type: Type.STRING }
                },
                required: ["input", "expectedOutput"]
              }
            }
          },
          required: ["id", "title", "description", "constraints", "inputFormat", "outputFormat", "sampleInput", "sampleOutput", "initialCode", "testCases"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse coding problems", e);
    return [];
  }
}

export async function runCode(code: string, language: string, input: string = ""): Promise<{ output: string; error?: string }> {
  const prompt = `Act as a code execution engine for ${language}.
  Code:
  ${code}
  
  Standard Input:
  ${input}
  
  Execute the code and provide the output. If there are syntax errors or runtime errors, provide the error message.
  Return as JSON with "output" and "error" (optional).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          output: { type: Type.STRING },
          error: { type: Type.STRING }
        },
        required: ["output"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{"output": "Execution failed"}');
  } catch (e) {
    return { output: "", error: "Failed to parse execution result" };
  }
}
