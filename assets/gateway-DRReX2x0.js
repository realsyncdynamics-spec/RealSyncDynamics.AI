import{G as r}from"./vendor-genai-CuXCPDcK.js";import{b as s}from"./index-DCM0vcNz.js";async function p(e){const i=e.context?`Hier ist der Inhalt einer Webseite:
"""
${e.context}
"""

Frage/Aufgabe des Nutzers:
${e.prompt}`:e.prompt,n=e.systemPrompt?`${e.systemPrompt}

---

${i}`:i;try{if(e.provider==="gemini"){let t;return e.customApiKey?t=new r({apiKey:e.customApiKey}):t=s(),{success:!0,provider:"gemini",modelOutput:(await t.models.generateContent({model:"gemini-3.1-pro-preview",contents:n})).text,tokensUsed:0}}if(e.provider==="openai")return await new Promise(t=>setTimeout(t,1e3)),{success:!0,provider:"openai",modelOutput:`🤖 **OpenAI (GPT-5) Mock-Antwort:**

Ich bin bereit, deine Anfrage zu bearbeiten: "${e.prompt}". 

*Hinweis: Dies läuft aktuell über das RealSync API-Gateway. Füge deinen OpenAI API-Key in den Settings hinzu, um Live-Ergebnisse zu sehen.*`};if(e.provider==="claude")return await new Promise(t=>setTimeout(t,1e3)),{success:!0,provider:"claude",modelOutput:`🧠 **Claude 4.6 Mock-Antwort:**

Hier ist meine Analyse zu deiner Anfrage: "${e.prompt}". 

*Hinweis: Dies läuft aktuell über das RealSync API-Gateway. Füge deinen Anthropic API-Key in den Settings hinzu, um Live-Ergebnisse zu sehen.*`};throw new Error(`Unsupported provider: ${e.provider}`)}catch(t){return{success:!1,error:t.message||"Gateway Error"}}}export{p};
