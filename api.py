from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from browser_use import Agent, Browser, ChatBrowserUse
from pydantic import BaseModel
import asyncio

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RunAgentRequest(BaseModel):
    task: str = "Open a news site, search for ‘AI’, and return the titles and URLs of the top 5 articles"

@app.post("/api/run-agent")
async def run_agent(request: RunAgentRequest):
    try:
        browser = Browser()
        llm = ChatBrowserUse()
        
        agent = Agent(
            task=request.task,
            llm=llm,
            browser=browser,
        )
        
        history = await agent.run()
        
        # Extract meaningful information from history
        result_data = {
            "task": request.task,
            "status": "completed",
            "summary": None,
            "actions": [],
            "final_result": None
        }
        
        # Parse history to extract key information
        history_str = str(history)
        
        # Try to extract structured data from history
        action_count = 0
        findings = []
        
        # Check if history is iterable (list of actions)
        try:
            if hasattr(history, '__iter__') and not isinstance(history, str):
                for item in history:
                    action_count += 1
                    # Try to extract meaningful action info
                    if hasattr(item, 'result'):
                        findings.append(str(item.result))
                    elif hasattr(item, 'output'):
                        findings.append(str(item.output))
        except:
            pass
        
        # Set summary based on action count
        if action_count > 0:
            result_data["summary"] = f"Agent completed {action_count} step(s) successfully"
        else:
            result_data["summary"] = "Task execution completed"
        
        # Extract final result or meaningful output
        if hasattr(history, 'final_result'):
            result_data["final_result"] = str(history.final_result())
        elif hasattr(history, 'result'):
            result_data["final_result"] = str(history.result())
        elif findings:
            # Combine all findings
            result_data["final_result"] = "\n\n".join(findings)
        else:
            # Clean up the history string for better readability
            # Remove excessive technical details
            cleaned = history_str.replace("AgentHistoryList", "")
            cleaned = cleaned.replace("AgentHistory", "")
            
            # Try to extract URLs and titles if present (common for news search tasks)
            if "http" in cleaned or "www." in cleaned:
                result_data["final_result"] = cleaned
            else:
                result_data["final_result"] = cleaned
        
        return result_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
