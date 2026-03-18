
from google import genai
import streamlit as st
# Llave
client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])


def get_model():
    try:
        models = [m.name for m in client.models.list()]
        final_model = next((m for m in models if '1.5-flash-8b' in m), None)
        if not final_model:
            final_model = next((m for m in models if '1.5-flash' in m and '2.' not in m), models[0])
        return final_model.replace('models/', '')
    except:
        return "gemini-1.5-flash"

def process_lesson(topic, level, extra, length, action, assessment_type, historical_context="", notes_text="", user_query=""):
    try:
        final_model = get_model()
        
        length_map = {"Short": "Brief, concise, and direct response", "Medium": "Balanced development", "Long": "Exhaustive, detailed, and deep analysis"}
        level_instruction = "Use everyday analogies and extremely basic language." if level < 5 else "Apply superior academic rigor, advanced technical terminology, and university-level formality."

        prompt = f"Role: High-level university professor.\nTOPIC: {topic}\nACADEMIC RIGOR: {level}/10 ({level_instruction})\nREQUESTED LENGTH: {length_map[length]}\nGUIDELINES: {extra}\n\n"

        prompt += "MANDATORY MATH FORMAT: Every equation or formula MUST be isolated on its own line using Display LaTeX syntax (example: $$ E = mc^2 $$). It is strictly forbidden to use plain text or code block formats for mathematics.\n\n"

        if notes_text:
            prompt += f"REFERENCE NOTES:\n{notes_text}\n\n"

        if historical_context and action not in ["summarize", "ask_question", "targeted_feedback"]:
            prompt += f"TAUGHT HISTORY:\n{historical_context}\n\n"

        # --- ACTION ROUTING LOGIC ---
        if action == "new":
            prompt += "TASK: Develop the first theoretical block of the topic."
        elif action == "advance_good":
            prompt += "TASK: Advance to the next logical concept. RULE: Forbidden to repeat information from the Taught History."
        elif action == "advance_bad":
            prompt += "TASK: The user requires clarification. Reformulate the last exposed concept in the history in a more didactic way."
        elif action == "summarize":
            prompt += f"FULL HISTORY:\n{historical_context}\n\nTASK: Create a structured executive synthesis with bullet points of all the previous material."
        elif action == "ask_question":
            prompt += f"CURRENT EXPLANATION CONTEXT:\n{historical_context}\n\nSTUDENT QUESTION: {user_query}\n\nTASK: Answer the student's specific question clearly and concisely, based on the current context."
        elif action == "targeted_feedback":
            prompt += f"CURRENT EXPLANATION CONTEXT:\n{historical_context}\n\nSTUDENT GRANULAR FEEDBACK: {user_query}\n\nTASK: The student has specified which exact parts they understood and which they did not. Reformulate, expand, or clarify ONLY the confusing parts mentioned. Acknowledge their feedback directly."

        # --- ASSESSMENT FORMATTING ---
        if action not in ["summarize", "ask_question", "targeted_feedback"] and assessment_type != "None":
            prompt += "\n\nFORMAT RULE: At the end of the theory, write a new line with exactly '---'.\n"
            if assessment_type == "Practical Exercises":
                prompt += "PRACTICAL SECTION: Below the '---', write 3 practical exercises adapted to the content. MANDATORY: Provide the step-by-step solution for each. Use HTML <br><br> to separate the exercise from the solution."
            elif assessment_type == "Multiple Choice Test":
                prompt += "ASSESSMENT: Below the '---', design a 3-question multiple-choice test based on the explanation. Put the correct answers at the very end."

        response = client.models.generate_content(model=final_model, contents=prompt)
        return response.text
    except Exception as e:
        return f"AI Service Exception: {e}"

def generate_study_plan(performance_data, syllabus_text=""):
    try:
        final_model = get_model()
        prompt = "Role: Academic advisor and study techniques expert.\nTASK: Design a strategic study plan based on the student's current grades.\n\n"
        prompt += f"RECORDED ACADEMIC PERFORMANCE:\n{performance_data}\n\n"
        
        if syllabus_text:
            prompt += f"REFERENCE SYLLABUS (Extract):\n{syllabus_text[:6000]}\n\n"
        
        prompt += "REQUIRED RESPONSE STRUCTURE:\n"
        prompt += "1. Performance Analysis: Identify critical subjects based on the simulated final grade.\n"
        prompt += "2. Recommended Techniques: Suggest proven methodologies (Feynman, Pomodoro, Spaced Repetition) justifying their use for the provided syllabus.\n"
        prompt += "3. Strategic Planning: An action schema to optimize study time.\n"
        prompt += "Maintain a strictly professional and resolute tone in English."

        response = client.models.generate_content(model=final_model, contents=prompt)
        return response.text
    except Exception as e:
        return f"AI Service Exception: {e}"