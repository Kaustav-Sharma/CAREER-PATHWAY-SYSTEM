document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const homePage = document.getElementById('home-page');
    const formPage = document.getElementById('form-page');
    const roadmapPage = document.getElementById('roadmap-page');
    const startJourneyBtn = document.getElementById('start-journey-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const skillForm = document.getElementById('skill-form');
    const goalInput = document.getElementById('goal-input');
    const skillInput = document.getElementById('skill-input');
    const currentRoleInput = document.getElementById('current-role-input');
    const timeCommitmentInput = document.getElementById('time-commitment-input');
    const learningStyleInput = document.getElementById('learning-style-input');
    const budgetInput = document.getElementById('budget-input');
    const additionalNotesInput = document.getElementById('additional-notes-input');
    const generateBtn = document.getElementById('generate-btn');
    const loader = document.getElementById('loader');
    const loadingSteps = document.getElementById('loading-steps');
    const roadmapContainer = document.getElementById('roadmap-container');
    const outputTitle = document.getElementById('output-title');
    const alignmentWarning = document.getElementById('alignment-warning');
    const roadmapStepper = document.getElementById('roadmap-stepper');
    const roadmapContent = document.getElementById('roadmap-content');
    const startOverBtn = document.getElementById('start-over-btn');
    const outputError = document.getElementById('output-error');

    // --- IMPORTANT: PASTE YOUR API KEYS HERE ---
    const googleApiKey = 'AIzaSyA3jDT97-QG9YJc18GQ-2LRLms80hrb-0Y';
    const tavilyApiKey = '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';

    let curriculumData = [];
    const stageColors = ['#8b5cf6', '#3b82f6', '#22c55e', '#ec4899', '#6366f1'];

    // --- Page Navigation ---
    const showPage = (pageToShow) => {
        [homePage, formPage, roadmapPage].forEach(page => {
            if (page.id === pageToShow) {
                page.style.transform = 'translateX(0%)';
                page.style.zIndex = 10;
            } else {
                page.style.transform = 'translateX(-100%)';
                 page.style.zIndex = 0;
            }
             if(pageToShow === 'form-page' && page.id === 'roadmap-page') page.style.transform = 'translateX(100%)';
             if(pageToShow === 'home-page' && page.id !== 'home-page') page.style.transform = 'translateX(100%)';
        });
    };
    
    startJourneyBtn.addEventListener('click', () => showPage('form-page'));
    backToHomeBtn.addEventListener('click', () => showPage('home-page'));
    startOverBtn.addEventListener('click', () => {
        showPage('form-page');
        skillForm.reset();
    });
    
    // --- Dynamic Loader ---
    const runLoadingSequence = async (isAligned = true) => {
        let steps = [ "Initializing AI...", "Performing skill-goal alignment check..." ];
        if (isAligned) {
            steps.push("Consulting web sources...", "Designing curriculum structure...", "Tailoring resources...", "Building your curriculum...");
        }
        loadingSteps.innerHTML = '';
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const li = document.createElement('li');
            li.className = 'flex items-center text-[var(--text-muted)] transition-all duration-500 opacity-50';
            li.innerHTML = `<div class="w-6 h-6 mr-4 flex items-center justify-center"><div class="spinner-small w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></div></div><span>${step}</span>`;
            loadingSteps.appendChild(li);
            await new Promise(res => setTimeout(res, 1000));
            li.classList.remove('opacity-50');
            li.classList.add('text-[var(--text-color)]');
            const iconContainer = li.querySelector('.spinner-small').parentElement;
            
            if (i === 1 && !isAligned) {
                 iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-500"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
                 return;
            }
            iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        }
    };

    // --- Core API and Rendering Logic ---
    async function tavilySearch(query) {
         let lastError = null;
         for (let i = 0; i < 3; i++) {
             try {
                const response = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: tavilyApiKey, query, search_depth: "advanced", max_results: 3 })
                });
                if (!response.ok) {
                    if (response.status === 432) {
                         throw new Error(`Tavily API key is invalid or has reached its limit.`);
                    }
                    throw new Error(`Tavily API responded with status: ${response.status}`);
                }
                const data = await response.json();
                return { success: true, results: data.results ? data.results.map(res => res.content).join("\n") : "" };
            } catch (e) {
                lastError = e;
                console.error(`🔴 Tavily search failed (attempt ${i+1}). Error:`, e);
                await new Promise(res => setTimeout(res, 1000 * (i + 1)));
            }
        }
        return { success: false, error: lastError };
    }

    async function callGemini(prompt) {
        const MAX_RETRIES = 3;
        let lastError;
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${googleApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });

                if (response.status === 503) {
                    lastError = new Error(`HTTP error! Status: 503. The model is overloaded.`);
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                    console.warn(`Model overloaded. Retrying in ${delay}ms...`);
                    await new Promise(res => setTimeout(res, delay));
                    continue;
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`HTTP error! Status: ${response.status}. Body: ${errorBody}`);
                }

                const data = await response.json();
                const jsonText = data.candidates[0].content.parts[0].text;
                let extractedJson = jsonText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
                const cleanedJson = extractedJson.replace(/,\s*([\]}])/g, '$1');
                return JSON.parse(cleanedJson);

            } catch (e) {
                lastError = e;
                console.error("🔴 ERROR: Gemini API call or JSON parsing failed.", e);
            }
        }
        throw lastError; // Throw the last captured error after all retries fail
    }
    
    function renderStepper(activeIndex) {
        roadmapStepper.innerHTML = '';
        curriculumData.forEach((section, index) => {
            const item = document.createElement('div');
            const color = stageColors[index % stageColors.length];
            item.className = 'stepper-item flex flex-col items-center cursor-pointer';
            item.style.setProperty('--accent-color', color);
            if (index < activeIndex) item.classList.add('completed');
            if (index === activeIndex) item.classList.add('active');
            item.dataset.index = index;

            item.innerHTML = `
                <div class="step-marker z-10 relative flex items-center justify-center rounded-full border-[var(--border-color)]">
                    ${index < activeIndex ? '✓' : index + 1}
                </div>
                <p class="step-title mt-2 text-xs font-semibold text-center">${section.title.replace('(Timeline)', '').replace('Ideas', '')}</p>
            `;
            roadmapStepper.appendChild(item);
        });
    }

    function renderStageContent(index) {
        const section = curriculumData[index];
        if (!section) return;
        
        roadmapContent.innerHTML = '';
        const contentContainer = document.createElement('div');
        contentContainer.className = 'fade-in-up';
        const color = stageColors[index % stageColors.length];

        const icons = {
            "Recommended Learning Order": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
            "Integrated Curriculum (Timeline)": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
            "Capstone Project Ideas": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M15.5 2.1a2.5 2.5 0 0 0-4 0l-1.1 1.1a1 1 0 0 0-.3.7V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3.9a1 1 0 0 0-.3-.7Z"/><path d="M20 9.5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1Z"/><path d="M4 14.5a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1Z"/></svg>`,
            "Tailored Resources": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
        };
        const sectionIcon = icons[section.title] || icons["Recommended Learning Order"];

        let contentHtml = '';
        
        const createCard = (title, icon, innerHtml) => `
            <div class="glass-card rounded-xl p-6 content-card" style="--accent-color: ${color}; border-top: 4px solid ${color};">
                <h3 class="font-bold text-lg flex items-center gap-3" style="color: ${color};">${icon}<span>${title}</span></h3>
                <div class="mt-4 text-[var(--text-muted)]">${innerHtml}</div>
            </div>`;
        
        if (section.title === "Recommended Learning Order") {
            const listHtml = `<ul>${section.content.map(item => `<li>${marked.parseInline(item)}</li>`).join('')}</ul>`;
            contentHtml = createCard("Learning Order", sectionIcon, listHtml);
        } else if (section.title === "Integrated Curriculum (Timeline)") {
            contentHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">` + section.content.map(item => `
                 <div class="glass-card rounded-xl p-6 content-card" style="--accent-color: ${color};">
                    <h3 class="font-bold text-lg flex items-center gap-3 text-[var(--text-color)]">${sectionIcon}<span>${item.period}</span></h3>
                    <div class="mt-4 text-[var(--text-muted)]"><ul>${item.focus.map(f => `<li>${marked.parseInline(f)}</li>`).join('')}</ul></div>
                </div>`).join('') + `</div>`;
        } else if (section.title === "Capstone Project Ideas") {
             contentHtml = `<div class="space-y-4">` + section.content.map(item => `
                <div class="glass-card rounded-xl p-6 content-card" style="--accent-color: ${color};">
                    <h3 class="font-bold text-lg flex items-center gap-3 text-[var(--text-color)]">${sectionIcon}<span>${item.project_title}</span></h3>
                    <div class="mt-4 text-[var(--text-muted)] prose prose-sm max-w-none">${marked.parse(item.description)}</div>
                </div>`).join('') + `</div>`;
        } else if (section.title === "Tailored Resources") {
            let resourcesHtml = '';
            for (const key in section.content) {
                const subTitle = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                resourcesHtml += `<h4 class="font-semibold text-base text-[var(--text-color)] mt-4">${subTitle}</h4><ul>${section.content[key].map(item => `<li>${marked.parseInline(item)}</li>`).join('')}</ul>`;
            }
            contentHtml = createCard("Resources", sectionIcon, resourcesHtml);
        }

        contentContainer.innerHTML = contentHtml;
        roadmapContent.appendChild(contentContainer);
        renderStepper(index);
    }
    
    async function generateCurriculum(profile) {
        showPage('roadmap-page');
        loader.classList.remove('hidden');
        roadmapContainer.classList.add('hidden');
        outputError.classList.add('hidden');
        generateBtn.disabled = true;
        
        await runLoadingSequence(true);

        const alignmentPrompt = `You are a career counselor. A user wants to achieve the goal: "${profile.goal}". They plan to learn these skills: ${profile.skills}. Their additional notes are: "${profile.notes}". Categorize the alignment into one of three levels: "perfect", "partial", or "misaligned". Your response must be a JSON object with two keys: "alignment_status": a string ("perfect", "partial", or "misaligned"), and "feedback": A concise, one-sentence explanation. If "partial" or "misaligned", provide suggestions.`;

        try {
            const alignmentResult = await callGemini(alignmentPrompt);
            
            if (alignmentResult.alignment_status === "misaligned") {
                await runLoadingSequence(false);
                loader.classList.add('hidden');
                outputError.classList.remove('hidden');
                outputError.innerHTML = `<div class="text-center p-4 border-2 border-red-500/50 rounded-lg"><h3 class="text-xl font-bold text-red-500">Alignment Error</h3><p class="mt-2 text-[var(--text-muted)]">${alignmentResult.feedback}</p><p class="mt-3 text-sm text-[var(--text-muted)]">Please adjust your skills or goal and try again.</p></div>`;
                return;
            }
            
            alignmentWarning.innerHTML = '';
            if (alignmentResult.alignment_status === "partial") {
                alignmentWarning.innerHTML = `<div class="p-4 border-2 border-yellow-500/50 rounded-lg text-center"><h4 class="font-bold text-yellow-500">Alignment Note</h4><p class="mt-1 text-sm text-[var(--text-muted)]">${alignmentResult.feedback}</p></div>`;
            }


            const searchQueries = [
                `learning path for a ${profile.role} to learn ${profile.skills} for ${profile.goal}`,
                `best ${profile.learningStyle} resources for ${profile.skills} with a budget of ${profile.budget}`,
                `capstone project ideas combining ${profile.skills}`
            ];
            const searchResults = await Promise.all(searchQueries.map(tavilySearch));
            let webContextInstruction;
            const successfulSearches = searchResults.filter(r => r.success);

            if (successfulSearches.length > 0) {
                 const context = successfulSearches.map(r => r.results).join("\n\n").trim();
                 webContextInstruction = `Based on this profile and the following web research, create a curriculum.\nWeb Research Context: --- ${context} ---`;
                 if(successfulSearches.length < searchQueries.length) {
                     alignmentWarning.innerHTML += `<div class="p-4 mt-4 border-2 border-blue-500/50 rounded-lg text-center"><h4 class="font-bold text-blue-500">Web Search Notice</h4><p class="mt-1 text-sm text-[var(--text-muted)]">Could not fetch all web results, possibly due to an invalid Tavily API key. The plan was generated using available data and general knowledge.</p></div>`;
                 }
            } else {
                console.warn("All web searches failed. Generating plan from general knowledge.");
                webContextInstruction = `IMPORTANT: Web search failed. Based on your own extensive knowledge, create a comprehensive and high-quality curriculum.`;
                alignmentWarning.innerHTML += `<div class="p-4 mt-4 border-2 border-blue-500/50 rounded-lg text-center"><h4 class="font-bold text-blue-500">Web Search Notice</h4><p class="mt-1 text-sm text-[var(--text-muted)]">Web search failed. This may be due to an invalid Tavily API key. The curriculum below was generated using the AI's general knowledge.</p></div>`;
            }


            const curriculumPrompt = `You are an expert curriculum designer. Create a personalized learning curriculum for this user:
                - Profile: ${JSON.stringify(profile)}
                ${webContextInstruction}
                The output MUST be a valid JSON array of objects. Each object is a section with a "title" and "content". The structure of "content" depends on the title:
                1.  "Recommended Learning Order": content is an array of strings.
                2.  "Integrated Curriculum (Timeline)": content is an array of objects, each with a "period" (string) and a "focus" (array of strings).
                3.  "Capstone Project Ideas": content is an array of objects, each with a "project_title" (string) and a "description" (string).
                4.  "Tailored Resources": content is an object with keys like "video_tutorials", "books_and_articles", and "interactive_platforms", each containing an array of strings.`;
            
            curriculumData = await callGemini(curriculumPrompt);
            loader.classList.add('hidden');
            roadmapContainer.classList.remove('hidden');
            outputTitle.textContent = `Your Curriculum for ${profile.goal}`;
            renderStageContent(0);

        } catch (error) {
            loader.classList.add('hidden');
            outputError.classList.remove('hidden');
            outputError.innerHTML = `<div class="text-center"><h3 class="text-xl font-bold text-red-500">Failed to Generate Curriculum</h3><p class="mt-2 text-[var(--text-muted)]">An error occurred. This is often an invalid API key or network problem. Please check your keys and try again.</p><p class="mt-4 text-xs font-mono bg-[var(--border-color)] p-3 rounded-md text-left whitespace-pre-wrap">${error.message}</p></div>`;
        } finally {
            generateBtn.disabled = false;
        }
    }
    
    // --- Event Listener ---
    skillForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (googleApiKey.includes('YOUR_') || tavilyApiKey.includes('YOUR_')) {
            alert("Please add your API keys to the <script> section of this HTML file.");
            return;
        }

        const profile = {
            goal: goalInput.value,
            skills: skillInput.value,
            role: currentRoleInput.value,
            timeCommitment: timeCommitmentInput.value,
            learningStyle: learningStyleInput.value,
            budget: budgetInput.value,
            notes: additionalNotesInput.value
        };
        
        generateCurriculum(profile);
    });

    roadmapStepper.addEventListener('click', (e) => {
        const stepperItem = e.target.closest('.stepper-item');
        if(stepperItem) {
            const index = parseInt(stepperItem.dataset.index);
            renderStageContent(index);
        }
    });
});
