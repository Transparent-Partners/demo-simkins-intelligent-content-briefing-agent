import os
from typing import Annotated, TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, BaseMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from app.schemas.strategic_brief import ProductionMasterPlan
from dotenv import load_dotenv
import json

load_dotenv()

# --- State Definition ---
class AgentState(TypedDict):
    messages: List[BaseMessage]
    current_plan: dict  # Stores the partial or complete ProductionMasterPlan

# --- LLM Setup ---
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    temperature=0.7, # Higher temp for creativity during brainstorming
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# --- Prompts ---
SYSTEM_PROMPT = """You are an expert Content Strategy Architect. 
Your goal is to interview the user to build a "Production Master Plan" for an Intelligent Content Brief.

The master plan is one object with two main parts:
1) A written creative brief (campaign story, objectives, audiences, SMP, constraints).
2) An execution layer (content matrix and bill of materials) that production teams can act on.

The structured plan includes:
- Core brief fields (campaign_name, single_minded_proposition, primary_audience, narrative_brief).
- Audience_matrix (rows describing segments, funnel stages, triggers, channels, notes) – often coming from an uploaded CSV.
- Channel_specs (per-channel / format specs and guardrails).
- Bill_of_materials (asset-level requirements: id, format, concept, source_type, specs).
- Logic_map (if/then style rules for dynamic assembly).
- Content_matrix (rows combining asset_id + audience_segment + stage + trigger + channel + format + message + variant + notes).

Your process:
- Phase 1 (Briefing): Act as a consultant. Ask clarifying questions one step at a time to co-write the narrative brief and fill in core fields.
- Use any uploaded audience matrix information explicitly (refer to segments, triggers, etc.).
- When the user indicates the brief feels solid, summarise it back as a clean narrative_brief and confirm.
- Phase 2 (Content Matrix): Propose a first pass content_matrix based on the brief, audience_matrix, and channel_specs.
- Think in terms of audience x funnel_stage x trigger x channel, and map rows to asset concepts in the bill_of_materials.
- Suggest sample concepts and labels for variants (e.g., FOMO, social proof, offer) that a creative director could react to.
- Keep your responses conversational, but you may occasionally show small JSON snippets when the user asks about structure.

Current Plan State:
{current_plan}
"""

# --- Nodes ---

def call_model(state: AgentState):
    messages = state['messages']
    current_plan_str = json.dumps(state.get('current_plan', {}), indent=2)
    
    # Prepend system instruction
    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(current_plan=current_plan_str))
    
    # We want the model to reply naturally, but we also want it to potentially update the plan.
    # For this simple version, we'll let the model just chat, and we'll use a separate extraction step
    # or just let it "chat" until it decides to output the JSON.
    # To keep it robust, let's just chat for now.
    
    response = llm.invoke([system_msg] + messages)
    return {"messages": [response]}

def should_continue(state: AgentState):
    last_message = state['messages'][-1]
    # In a more complex agent, we'd check for function calls or specific stop tokens.
    # Here, we just return END for a single turn, but the graph preserves state across API calls.
    return END

# --- Graph Construction ---
workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

app_graph = workflow.compile()

# --- Helper for API ---
async def process_message(history: List[dict], current_plan: dict):
    # Convert dict history to LangChain messages
    messages = []
    for msg in history:
        if msg['role'] == 'user':
            messages.append(HumanMessage(content=msg['content']))
        elif msg['role'] == 'assistant':
            messages.append(AIMessage(content=msg['content']))
    
    inputs = {
        "messages": messages,
        "current_plan": current_plan
    }
    
    # Run the graph
    result = await app_graph.ainvoke(inputs)
    
    # Get the latest response
    last_msg = result['messages'][-1]
    return last_msg.content
