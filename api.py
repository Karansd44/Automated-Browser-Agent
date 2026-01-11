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
        action_count = 0
        final_answer = None
        
        # Check if history is iterable (list of actions)
        try:
            if hasattr(history, '__iter__') and not isinstance(history, str):
                # Get the last item which should contain the final result
                history_list = list(history)
                action_count = len(history_list)
                
                # Look for the final result in the last action
                if history_list:
                    last_action = history_list[-1]
                    
                    # Try different attributes to get the final result
                    if hasattr(last_action, 'result') and last_action.result:
                        result_obj = last_action.result
                        # Check if result has extracted_content or similar
                        if hasattr(result_obj, 'extracted_content'):
                            final_answer = str(result_obj.extracted_content)
                        elif hasattr(result_obj, 'text'):
                            final_answer = str(result_obj.text)
                        elif hasattr(result_obj, 'content'):
                            final_answer = str(result_obj.content)
                        else:
                            final_answer = str(result_obj)
                    
                    # Try model_output for the final answer
                    if not final_answer and hasattr(last_action, 'model_output'):
                        model_output = last_action.model_output
                        if hasattr(model_output, 'current_state') and hasattr(model_output.current_state, 'output'):
                            final_answer = str(model_output.current_state.output)
                        elif hasattr(model_output, 'output'):
                            final_answer = str(model_output.output)
                    
                    # Check for done action with final result
                    if not final_answer and hasattr(last_action, 'action_name') and last_action.action_name == 'done':
                        if hasattr(last_action, 'extracted_content'):
                            final_answer = str(last_action.extracted_content)
        except Exception as e:
            print(f"Error extracting from history: {e}")
        
        # Set summary based on action count
        if action_count > 0:
            result_data["summary"] = f"Agent completed {action_count} step(s) successfully"
        else:
            result_data["summary"] = "Task execution completed"
        
        # Extract final result or meaningful output
        if final_answer:
            result_data["final_result"] = final_answer
        elif hasattr(history, 'final_result'):
            result_data["final_result"] = str(history.final_result())
        elif hasattr(history, 'result'):
            result_data["final_result"] = str(history.result())
        else:
            # Fallback: try to extract from history string
            history_str = str(history)
            # Look for patterns that indicate final results
            if "extracted_content=" in history_str:
                import re
                match = re.search(r"extracted_content='([^']+)'", history_str)
                if match:
                    result_data["final_result"] = match.group(1)
                else:
                    match = re.search(r'extracted_content="([^"]+)"', history_str)
                    if match:
                        result_data["final_result"] = match.group(1)
            
            # If still no result, use cleaned history
            if not result_data["final_result"]:
                cleaned = history_str.replace("AgentHistoryList", "")
                cleaned = cleaned.replace("AgentHistory", "")
                result_data["final_result"] = cleaned
        
        return result_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
