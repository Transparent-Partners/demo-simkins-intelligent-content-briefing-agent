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

This plan must include:
1. Campaign Name & Single Minded Proposition
2. Primary Audience
3. A "Bill of Materials" (the specific assets needed: formats, concepts, specs)
4. A "Logic Map" (how these assets are dynamically assembled based on data triggers)

Your process:
- Act as a consultant. Ask clarifying questions one step at a time.
- Don't overwhelm the user.
- Suggest ideas if the user is stuck (e.g., "For a retargeting audience, we typically need a 'fear of missing out' variant. Should we add that?").
- When you have enough information for a section, confirm it with the user.
- If the user says "we're done" or asks to generate the final brief, produce the final JSON structure.

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
