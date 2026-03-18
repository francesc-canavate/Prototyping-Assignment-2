import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
from fastapi import UploadFile, File
import PyPDF2
import io

class GradingRequest(BaseModel):
    question: str
    student_answer: str
    syllabus_text: str

# NEW: Data model for the Knowledge Graph request
class GraphRequest(BaseModel):
    topic: str
    historical_context: str

# Cargar variables de entorno (tu API key)
load_dotenv()

# Inicializar cliente de Google
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY no encontrada. Asegúrate de crear el archivo .env")

client = genai.Client(api_key=api_key)

# Inicializar la API
app = FastAPI(title="AI Tutor Backend REST API")

# Configurar CORS (Permite que el frontend en Next.js se comunique con este backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción se cambia por la URL de tu Next.js
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_model():
    # Dejamos fijo el modelo Lite como acordamos para evitar cuellos de botella de cuota
    return "gemini-2.5-flash-lite"

# --- MODELOS DE DATOS (Lo que esperamos recibir del Frontend) ---
class LessonRequest(BaseModel):
    topic: str
    level: int
    extra: str
    length: str
    action: str
    assessment_type: str
    historical_context: str = ""
    notes_text: str = ""
    user_query: str = ""

class StudyPlanRequest(BaseModel):
    performance_data: str
    syllabus_text: str = ""


# --- ENDPOINTS (Las URLs a las que llamará Next.js) ---

@app.post("/api/lesson")
async def process_lesson_endpoint(req: LessonRequest):
    try:
        final_model = get_model()
        
        length_map = {"Short": "Brief, concise, and direct response", "Medium": "Balanced development", "Long": "Exhaustive, detailed, and deep analysis"}
        level_instruction = "Use everyday analogies and extremely basic language." if req.level < 5 else "Apply superior academic rigor, advanced technical terminology, and university-level formality."

        prompt = f"Role: High-level university professor.\nTOPIC: {req.topic}\nACADEMIC RIGOR: {req.level}/10 ({level_instruction})\nREQUESTED LENGTH: {length_map[req.length]}\nGUIDELINES: {req.extra}\n\n"

        prompt += "MANDATORY MATH FORMAT: Every equation or formula MUST be isolated on its own line using Display LaTeX syntax (example: $$ E = mc^2 $$). It is strictly forbidden to use plain text or code block formats for mathematics.\n\n"

        if req.notes_text:
            prompt += f"REFERENCE NOTES:\n{req.notes_text}\n\n"

        if req.historical_context and req.action not in ["summarize", "ask_question", "targeted_feedback"]:
            prompt += f"TAUGHT HISTORY:\n{req.historical_context}\n\n"

        # --- ACTION ROUTING LOGIC ---
        if req.action == "new":
            prompt += "TASK: Develop the first theoretical block of the topic."
        elif req.action == "advance_good":
            prompt += "TASK: Advance to the next logical concept. RULE: Forbidden to repeat information from the Taught History."
        elif req.action == "advance_bad":
            prompt += "TASK: The user requires clarification. Reformulate the last exposed concept in the history in a more didactic way."
        elif req.action == "summarize":
            prompt += f"FULL HISTORY:\n{req.historical_context}\n\nTASK: Create a structured executive synthesis with bullet points of all the previous material."
        elif req.action == "ask_question":
            prompt += f"CURRENT EXPLANATION CONTEXT:\n{req.historical_context}\n\nSTUDENT QUESTION: {req.user_query}\n\nTASK: Answer the student's specific question clearly and concisely, based on the current context."
        elif req.action == "targeted_feedback":
            prompt += f"CURRENT EXPLANATION CONTEXT:\n{req.historical_context}\n\nSTUDENT GRANULAR FEEDBACK: {req.user_query}\n\nTASK: The student has specified which exact parts they understood and which they did not. Reformulate, expand, or clarify ONLY the confusing parts mentioned. Acknowledge their feedback directly."

        # --- ASSESSMENT FORMATTING ---
        if req.action not in ["summarize", "ask_question", "targeted_feedback"] and req.assessment_type != "None":
            prompt += "\n\nFORMAT RULE: At the end of the theory, write a new line with exactly '---'.\n"
            if req.assessment_type == "Practical Exercises":
                prompt += "PRACTICAL SECTION: Below the '---', write 3 practical exercises adapted to the content. MANDATORY: Provide the step-by-step solution for each. Use HTML <br><br> to separate the exercise from the solution."
            elif req.assessment_type == "Multiple Choice Test":
                prompt += "ASSESSMENT: Below the '---', design a 3-question multiple-choice test based on the explanation. Put the correct answers at the very end."

        response = client.models.generate_content(model=final_model, contents=prompt)
        # Devolvemos un diccionario que FastAPI convierte automáticamente a JSON
        return {"status": "success", "response": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Service Exception: {e}")

@app.post("/api/study-plan")
async def generate_study_plan_endpoint(req: StudyPlanRequest):
    try:
        final_model = get_model()
        prompt = "Role: Academic advisor and study techniques expert.\nTASK: Design a strategic study plan based on the student's current grades.\n\n"
        prompt += f"RECORDED ACADEMIC PERFORMANCE:\n{req.performance_data}\n\n"
        
        if req.syllabus_text:
            prompt += f"REFERENCE SYLLABUS (Extract):\n{req.syllabus_text[:6000]}\n\n"
        
        prompt += "REQUIRED RESPONSE STRUCTURE:\n"
        prompt += "1. Performance Analysis: Identify critical subjects based on the simulated final grade.\n"
        prompt += "2. Recommended Techniques: Suggest proven methodologies (Feynman, Pomodoro, Spaced Repetition) justifying their use for the provided syllabus.\n"
        prompt += "3. Strategic Planning: An action schema to optimize study time.\n"
        prompt += "Maintain a strictly professional and resolute tone in English."

        response = client.models.generate_content(model=final_model, contents=prompt)
        return {"status": "success", "response": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Service Exception: {e}")

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return {"status": "success", "text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF reading error: {e}")

@app.post("/api/grade")
async def grade_student_answer(req: GradingRequest):
    try:
        grading_prompt = f"""
        You are an expert university evaluator.
        Evaluate the student's answer using the provided syllabus text as your primary rubric.
        
        Syllabus Reference:
        {req.syllabus_text}
        
        Question Asked: {req.question}
        Student's Answer: {req.student_answer}
        
        GRADING RULES:
        1. The core of the answer must align with the syllabus concepts.
        2. DO NOT penalize the student for providing accurate extra context or advanced knowledge outside the syllabus. Reward comprehensive understanding.
        3. Be fair and constructive.
        
        Return your response EXACTLY in this format:
        Grade: [A number from 0 to 10]
        Feedback: [Provide a detailed, constructive paragraph (4-5 sentences) explaining exactly why they got this grade and what they missed or did well.]
        """
        # Using your dynamic model fetcher!
        final_model = get_model() 
        
        response = client.models.generate_content(
            model=final_model, 
            contents=grading_prompt
        )
        
        return {"status": "success", "evaluation": response.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grading error: {str(e)}")
# NEW: Knowledge Graph Endpoint
@app.post("/api/graph")
async def generate_knowledge_graph(req: GraphRequest):
    try:
        final_model = get_model()
        prompt = f"""
        You are an expert data architect. Your task is to extract a Knowledge Graph from the following academic context.
        
        Topic: {req.topic}
        Context: {req.historical_context}
        
        Return the output STRICTLY as a valid JSON object with the following structure:
        {{
          "nodes": [
            {{"id": "1", "label": "Main Concept", "description": "A clear, 2-sentence educational definition of this concept."}},
            {{"id": "2", "label": "Sub Concept", "description": "A clear, 2-sentence educational definition of this concept."}}
          ],
          "edges": [
            {{"source": "1", "target": "2", "label": "includes"}}
          ]
        }}
        
        Rules:
        1. Extract exactly 5 to 8 key concepts as nodes.
        2. MANDATORY: Write a highly accurate 'description' for every single node based on the context.
        3. Extract meaningful relationships as edges connecting those IDs.
        4. Return ONLY valid JSON. No markdown formatting, no code blocks (do not wrap in ```json), just the raw JSON object.
        """
        
        response = client.models.generate_content(
            model=final_model, 
            contents=prompt
        )
        
        # Cleanup logic in case Gemini adds markdown code blocks
        clean_text = response.text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        graph_data = json.loads(clean_text.strip())
        
        return {"status": "success", "graph": graph_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph error: {str(e)}")