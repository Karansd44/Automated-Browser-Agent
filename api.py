import os
import uvicorn
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Browser Use imports
from browser_use import Agent, Browser

# LangChain imports (Standard for browser-use LLM integration)
from langchain_openai import ChatOpenAI

# --- GLOBAL STATE MANAGEMENT ---
# We keep the browser instance alive globally to avoid the 3-5s startup time per request.
browser_instance: Optional[Browser] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: Launch browser once
    global browser_instance
    print("🚀 Starting Global Browser Instance...")
    browser_instance = Browser(
        headless=True,
        disable_images=True,  # CRITICAL: Makes browsing ~3x faster
        # Add other browser configs if needed (e.g., proxy, user_agent)
    )
    yield
    # 2. Shutdown: Close browser cleanly
    print("🛑 Shutting down browser...")
    if browser_instance:
        await browser_instance.close()

app = FastAPI(lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REQUEST MODELS ---
class RunAgentRequest(BaseModel):
    task: str
    model: str = "gpt-4o-mini"  # Default to fast/cheap model
    max_steps: int = 50          # Prevent infinite loops

class AgentResponse(BaseModel):
    task: str
    status: str
    steps_taken: int
    final_result: Optional[str]
    model_used: str

# --- ENDPOINT ---
@app.post("/api/run-agent", response_model=AgentResponse)
async def run_agent(request: RunAgentRequest):
    if not browser_instance:
        raise HTTPException(status_code=500, detail="Browser not initialized")

    try:
        # 1. Configure LLM
        # We use temperature=0 for deterministic, factual extraction
        llm = ChatOpenAI(
            model=request.model, 
            temperature=0,
            timeout=60,  # Timeout for LLM calls
        )
        
        # 2. Initialize Agent
        # We pass the global browser instance. browser-use handles creating a new context/tab.
        agent = Agent(
            task=request.task,
            llm=llm,
            browser=browser_instance,
            use_vision=True,  # Keep True for advanced understanding, set False for max speed
            max_steps=request.max_steps
        )
        
        print(f"🤖 Starting task: {request.task[:50]}...")
        
        final_result = None
        steps = 0

        # 3. Run Agent (Async Generator)
        # The agent yields history items. We iterate until completion.
        # We don't store all history in memory to save RAM, just track the last state.
        async for step in agent.run():
            steps += 1
            # Optional: You could stream 'step' to the client via WebSockets here
            
            # Advanced: Check the step for the final result content immediately
            if hasattr(step, 'extracted_content') and step.extracted_content:
                final_result = step.extracted_content
        
        # Fallback: If extracted_content is missing, check the last step's model output
        if not final_result:
            # Sometimes the result is in the final 'Done' action
            if hasattr(step, 'model_output') and step.model_output:
                 mo = step.model_output
                 if hasattr(mo, 'output') and mo.output:
                     final_result = mo.output

        # If still no result, provide a generic summary
        if not final_result:
            final_result = f"Task executed {steps} steps, but no specific content was extracted. Check logs."

        print(f"✅ Task completed in {steps} steps.")

        return AgentResponse(
            task=request.task,
            status="completed",
            steps_taken=steps,
            final_result=final_result,
            model_used=request.model
        )

    except Exception as e:
        print(f"❌ Error during agent execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)