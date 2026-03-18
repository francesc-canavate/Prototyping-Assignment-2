import streamlit as st
import PyPDF2
import pandas as pd
import altair as alt
from tutor_ai import process_lesson, generate_study_plan

st.set_page_config(page_title="Comprehensive Academic Platform", layout="wide")

def extract_text(file):
    text = ""
    if file.name.endswith('.pdf'):
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text()
    else:
        text = file.read().decode('utf-8')
    return text

if 'history' not in st.session_state:
    st.session_state.history = ""
if 'current_card' not in st.session_state:
    st.session_state.current_card = ""
if 'show_summary' not in st.session_state:
    st.session_state.show_summary = False
if 'subjects' not in st.session_state:
    st.session_state.subjects = {}

# --- MAIN NAVIGATION ---
st.sidebar.title("System Navigation")
current_view = st.sidebar.radio("Select operational module:", ["Interactive Tutor", "Performance Manager"])

# ==========================================
# VIEW 1: INTERACTIVE TUTOR
# ==========================================
if current_view == "Interactive Tutor":
    st.title("Adaptive Learning System")

    with st.sidebar:
        st.divider()
        st.header("System Parameters")
        level = st.slider("Academic Rigor", 1, 10, 5)
        length = st.select_slider("Analysis Depth", options=["Short", "Medium", "Long"], value="Medium")
        extra = st.text_area("Specific Guidelines", placeholder="Insert methodological instructions...")
        
        st.divider()
        st.header("Assessment Generation")
        assessment_type = st.radio("Select assessment format:", ["None", "Practical Exercises", "Multiple Choice Test"])

        st.divider()
        st.header("Context Upload (Documents)")
        uploaded_file = st.file_uploader("Attach reference PDF or TXT", type=["pdf", "txt"], key="doc_tutor")
        notes_text = ""
        if uploaded_file:
            notes_text = extract_text(uploaded_file)
            st.success("Document indexed in temporary memory.")

    topic = st.text_input("Define the subject of study:")

    if st.button("Start Study Session", type="primary"):
        if topic:
            with st.spinner("Processing parameters..."):
                st.session_state.show_summary = False
                response = process_lesson(topic, level, extra, length, "new", assessment_type, notes_text=notes_text)
                st.session_state.current_card = response
                st.session_state.history = response
        else:
            st.warning("Subject definition is required.")

    if st.session_state.current_card:
        st.markdown("---")
        
        parts = st.session_state.current_card.split("---")
        st.write(parts[0]) # Main explanation
        
        if len(parts) > 1:
            with st.expander("View Generated Assessment / Exercises"):
                st.markdown(parts[1], unsafe_allow_html=True)

        st.markdown("---")
        
        # --- NEW SECTION: SPECIFIC Q&A AND GRANULAR FEEDBACK ---
        st.subheader("Targeted Queries & Granular Feedback")
        col_q, col_f = st.columns(2)
        
        with col_q:
            specific_q = st.text_input("Ask a specific question about this content:", placeholder="E.g., Why is formula X used here?")
            if st.button("Submit Question", use_container_width=True):
                if specific_q:
                    with st.spinner("Analyzing query..."):
                        answer = process_lesson(topic, level, extra, length, "ask_question", "None", historical_context=parts[0], user_query=specific_q)
                        # Append securely before the assessment separator
                        new_content = f"\n\n**Student Question:** {specific_q}\n\n**Instructor Response:**\n{answer}"
                        if len(parts) > 1:
                            st.session_state.current_card = parts[0] + new_content + "\n\n---\n" + parts[1]
                        else:
                            st.session_state.current_card += new_content
                        st.session_state.history += new_content
                        st.rerun()

        with col_f:
            specific_fb = st.text_input("Specify which exact parts you understood and which need review:", placeholder="E.g., I understood the definition, but the second example is confusing.")
            if st.button("Apply Granular Feedback", use_container_width=True):
                if specific_fb:
                    with st.spinner("Adjusting targeted content..."):
                        adjustment = process_lesson(topic, level, extra, length, "targeted_feedback", "None", historical_context=parts[0], user_query=specific_fb)
                        new_content = f"\n\n**Targeted Review based on your feedback:**\n\n{adjustment}"
                        if len(parts) > 1:
                            st.session_state.current_card = parts[0] + new_content + "\n\n---\n" + parts[1]
                        else:
                            st.session_state.current_card += new_content
                        st.session_state.history += new_content
                        st.rerun()

        st.markdown("---")
        
        # --- MAIN NAVIGATION BUTTONS ---
        col_fb1, col_fb2, col_fb3 = st.columns(3)
        with col_fb1:
            if st.button("Content Assimilated (Advance Topic)", use_container_width=True):
                with st.spinner("Calculating next concept..."):
                    st.session_state.show_summary = False
                    new_class = process_lesson(topic, level, extra, length, "advance_good", assessment_type, historical_context=st.session_state.history, notes_text=notes_text)
                    st.session_state.current_card = new_class
                    st.session_state.history += "\n\n" + new_class
                    st.rerun()

        with col_fb2:
            if st.button("Requires General Clarification (Reformulate All)", use_container_width=True):
                with st.spinner("Applying general didactic simplification..."):
                    st.session_state.show_summary = False
                    new_class = process_lesson(topic, level, extra, length, "advance_bad", assessment_type, historical_context=st.session_state.history, notes_text=notes_text)
                    st.session_state.current_card = new_class
                    st.session_state.history += "\n\n" + new_class
                    st.rerun()

        with col_fb3:
            if st.button("Generate Syllabus Synthesis", use_container_width=True):
                st.session_state.show_summary = True

    if st.session_state.show_summary and st.session_state.history:
        st.divider()
        st.subheader("Executive Synthesis of the History")
        with st.spinner("Generating summary..."):
            summary = process_lesson(topic, level, extra, length, "summarize", "None", historical_context=st.session_state.history)
            st.info(summary)

# ==========================================
# VIEW 2: PERFORMANCE MANAGER
# ==========================================
elif current_view == "Performance Manager":
    st.title("Grades and Planning Manager")

    col_form, col_panel = st.columns([1, 1])

    with col_form:
        st.subheader("Subject Registration")
        with st.form("form_registro_asig"):
            subject_name = st.text_input("Subject Name")
            num_evals = st.number_input("Number of evaluations", min_value=1, max_value=10, value=3)
            weights_str = st.text_input("Percentage weight (E.g.: 20, 30, 50)", placeholder="Separated by comma. Total: 100")
            submit_subject = st.form_submit_button("Add Subject")

            if submit_subject and subject_name and weights_str:
                try:
                    weights = [float(p.strip()) for p in weights_str.split(',')]
                    if len(weights) == num_evals and sum(weights) == 100:
                        st.session_state.subjects[subject_name] = {
                            "evaluations": num_evals,
                            "weights": weights,
                            "grades": [0.0] * num_evals,
                            "completed": [False] * num_evals,
                            "eval_names": [f"Evaluation {i+1}" for i in range(num_evals)]
                        }
                        st.success("Registration completed.")
                    else:
                        st.error("Error: The number of weights does not match the evaluations or does not sum to 100.")
                except ValueError:
                    st.error("Format error in weights.")

    with col_panel:
        st.subheader("Grades Simulator")
        if not st.session_state.subjects:
            st.info("System without data. Register subjects in the left panel.")
        else:
            for asig, data in st.session_state.subjects.items():
                with st.expander(f"Subject: {asig}"):
                    if "completed" not in data:
                        data["completed"] = [False] * data["evaluations"]
                    if "eval_names" not in data:
                        data["eval_names"] = [f"Evaluation {i+1}" for i in range(data["evaluations"])]

                    for i in range(data["evaluations"]):
                        current_weight = data["weights"][i]
                        
                        col_chk, col_name, col_num = st.columns([1, 2, 2])
                        with col_chk:
                            st.write("") 
                            st.write("")
                            completed = st.checkbox("Done", value=data["completed"][i], key=f"chk_{asig}_{i}")
                            data["completed"][i] = completed
                        with col_name:
                            new_name = st.text_input("Eval Name", value=data["eval_names"][i], key=f"name_{asig}_{i}", label_visibility="collapsed")
                            data["eval_names"][i] = new_name
                        with col_num:
                            new_grade = st.number_input(
                                f"Grade ({current_weight}%)", 
                                min_value=0.0, max_value=10.0, 
                                value=data["grades"][i], 
                                disabled=not completed, 
                                key=f"grade_{asig}_{i}",
                                label_visibility="collapsed"
                            )
                            data["grades"][i] = new_grade
                    
                    evaluated_weight = sum(data["weights"][i] for i in range(data["evaluations"]) if data["completed"][i])
                    if evaluated_weight > 0:
                        accumulated_grade = sum(data["grades"][i] * data["weights"][i] for i in range(data["evaluations"]) if data["completed"][i])
                        average = accumulated_grade / evaluated_weight
                        st.markdown(f"**Current Average: {average:.2f}/10**")
                        st.caption(f"Evaluated course progress: {evaluated_weight}%")
                    else:
                        st.markdown("**Current Average: N/A**")
                        st.caption("No evaluations marked as done.")

    # --- VISUAL SECTION (ALTAIR CHARTS) ---
    st.divider()
    st.subheader("Global Performance Visualization")
    
    if st.session_state.subjects:
        avg_data = []
        for asig, data in st.session_state.subjects.items():
            evaluated_weight = sum(data["weights"][i] for i in range(data["evaluations"]) if data["completed"][i])
            if evaluated_weight > 0:
                acc_grade = sum(data["grades"][i] * data["weights"][i] for i in range(data["evaluations"]) if data["completed"][i])
                avg_data.append({"Subject": asig, "Average Grade": acc_grade / evaluated_weight})
            else:
                avg_data.append({"Subject": asig, "Average Grade": 0.0})
                
        if avg_data:
            df_avg = pd.DataFrame(avg_data)
            
            chart_avg = alt.Chart(df_avg).mark_bar().encode(
                x=alt.X('Subject:N', title='Registered Subjects', axis=alt.Axis(labelAngle=0, labelFontSize=14, labelFontWeight='bold')),
                y=alt.Y('Average Grade:Q', scale=alt.Scale(domain=[0, 10])),
                color=alt.Color('Subject:N', legend=None) 
            ).properties(title="Average Grades per Subject", height=300)
            
            st.altair_chart(chart_avg, use_container_width=True)

        st.markdown("<br>", unsafe_allow_html=True)

        eval_data = []
        for asig, data in st.session_state.subjects.items():
            for i in range(data["evaluations"]):
                if data["completed"][i]:
                    eval_data.append({
                        "Subject": asig,
                        "Evaluation": data["eval_names"][i],
                        "Grade": data["grades"][i]
                    })
        
        if eval_data:
            df_eval = pd.DataFrame(eval_data)
            chart_evals = alt.Chart(df_eval).mark_bar().encode(
                x=alt.X('Evaluation:N', title=None, axis=alt.Axis(labelAngle=-45)),
                y=alt.Y('Average Grade:Q', scale=alt.Scale(domain=[0, 10])), # Corrected scale label consistency 
                color='Evaluation:N',
                column=alt.Column('Subject:N', header=alt.Header(labelFontSize=14, labelFontWeight='bold'))
            ).properties(width=150, height=300, title="Grade Distribution by Evaluation")

            st.altair_chart(chart_evals, use_container_width=False)
        else:
            st.info("Mark evaluations as 'Done' to see the detailed evaluation distribution chart.")

    else:
        st.info("Add subjects and evaluations to visualize your general performance.")

    # --- STUDY PLAN ---
    st.divider()
    st.subheader("Study Consulting and Academic Intelligence")
    syllabus_file = st.file_uploader("Attach official syllabus (PDF) for methodological analysis", type=["pdf", "txt"], key="doc_plan")
    
    if st.button("Process Strategic Study Plan", type="primary", use_container_width=True):
        if not st.session_state.subjects:
            st.warning("A minimum of one registered subject is required to generate analytics.")
        else:
            syllabus_text = extract_text(syllabus_file) if syllabus_file else ""
            with st.spinner("Analyzing performance metrics and processing recommendations..."):
                notes_summary = ""
                for a, d in st.session_state.subjects.items():
                    peso_ev = sum(d["weights"][i] for i in range(d["evaluations"]) if d["completed"][i])
                    if peso_ev > 0:
                        acum = sum(d["grades"][i] * d["weights"][i] for i in range(d["evaluations"]) if d["completed"][i])
                        real_avg = acum / peso_ev
                        notes_summary += f"- {a}: Current average = {real_avg:.2f} (Based on {peso_ev}% of the evaluated course)\n"
                    else:
                        notes_summary += f"- {a}: No evaluations completed yet.\n"
                
                strategic_plan = generate_study_plan(notes_summary, syllabus_text)
                st.markdown("---")
                st.write(strategic_plan)