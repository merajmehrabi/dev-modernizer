(function () {
  const repositoryInput = document.getElementById('repository');
  const directoryInput = document.getElementById('directory');
  const folderInput = document.getElementById('folder');
  const forceInput = document.getElementById('force');
  const dryRunInput = document.getElementById('dry-run');
  const runForm = document.getElementById('run-form');
  const previewButton = document.getElementById('preview-prompt');
  const runButton = document.getElementById('run-button');
  const promptOutput = document.getElementById('prompt-output');
  const promptStatus = document.getElementById('prompt-status');
  const logOutput = document.getElementById('log-output');
  const runStatus = document.getElementById('run-status');
  const repoPanel = document.getElementById('repo-panel');
  const promptPanel = document.getElementById('prompt-panel');
  const maximizeLogBtn = document.getElementById('maximize-log');
  const logModal = document.getElementById('log-modal');
  const modalLogOutput = document.getElementById('modal-log-output');
  const closeLogModalBtn = document.getElementById('close-log-modal');
  const artifactsStatus = document.getElementById('artifacts-status');
  const statusPlan = document.getElementById('status-plan');
  const statusChangelog = document.getElementById('status-changelog');
  const statusReview = document.getElementById('status-review');
  const viewPlanBtn = document.getElementById('view-plan');
  const viewChangelogBtn = document.getElementById('view-changelog');
  const viewReviewBtn = document.getElementById('view-review');
  const docModal = document.getElementById('doc-modal');
  const docOutput = document.getElementById('doc-output');
  const closeDocModalBtn = document.getElementById('close-doc-modal');
  const tabPlan = document.getElementById('tab-plan');
  const tabChangelog = document.getElementById('tab-changelog');
  const tabReview = document.getElementById('tab-review');
  const artifactOutput = document.getElementById('artifact-output');

  let folderManuallyEdited = false;
  let currentLogStream = null;
  let currentFilesStream = null;
  let currentDocName = null;
  const artifactStates = {
    'plan.md': { seen: false, mtime: 0 },
    'changelog.md': { seen: false, mtime: 0 },
    'review.md': { seen: false, mtime: 0 },
  };
  let selectedArtifact = 'plan.md';

  function deriveFolderName(repository) {
    if (!repository) {
      return '';
    }

    const parts = repository.split('/');
    const lastSegment = parts.pop() || repository;
    const cleaned = lastSegment.replace(/\.git$/i, '');
    return cleaned || 'repository';
  }

  function setStatus(element, message, type = 'info') {
    if (!element) {
      return;
    }

    element.textContent = message || '';
    element.className = `status ${type}`;
    
    // Add loading animation for certain states
    if (message && (message.includes('Loading') || message.includes('Running'))) {
      element.classList.add('loading');
    } else {
      element.classList.remove('loading');
    }
  }

  function setBadge(element, text, type = 'neutral') {
    if (!element) return;
    element.textContent = text;
    element.style.background = type === 'success' ? 'rgba(72, 187, 120, 0.15)'
      : type === 'error' ? 'rgba(245, 101, 101, 0.15)'
      : type === 'warn' ? 'rgba(251, 191, 36, 0.15)'
      : 'rgba(0,0,0,0.06)';
    element.style.color = type === 'success' ? '#2f855a'
      : type === 'error' ? '#c53030'
      : type === 'warn' ? '#975a16'
      : '#4a5568';
  }

  function setPanelsCollapsed(collapsed) {
    if (repoPanel) repoPanel.classList.toggle('collapsed', collapsed);
    if (promptPanel) promptPanel.classList.toggle('collapsed', collapsed);
  }

  async function loadArtifactToInline(name) {
    try {
      const file = await fetchFile(name);
      if (artifactOutput) {
        artifactOutput.textContent = file.content || '';
        artifactOutput.scrollTop = artifactOutput.scrollHeight;
      }
    } catch (e) {
      if (artifactOutput) artifactOutput.textContent = 'Not available yet.';
    }
  }

  function setActiveTab(name) {
    selectedArtifact = name;
    if (tabPlan) tabPlan.classList.toggle('active', name === 'plan.md');
    if (tabChangelog) tabChangelog.classList.toggle('active', name === 'changelog.md');
    if (tabReview) tabReview.classList.toggle('active', name === 'review.md');
    loadArtifactToInline(name);
  }

  function animateOutput(element, text) {
    if (!element || !text) return;
    
    // Clear existing content
    element.textContent = '';
    
    // For long text, just set it directly to avoid performance issues
    if (text.length > 500) {
      element.textContent = text;
      element.scrollTop = element.scrollHeight;
      return;
    }
    
    // Animate shorter text
    let i = 0;
    function typeWriter() {
      if (i < text.length) {
        element.textContent = text.substring(0, i + 1);
        i++;
        element.scrollTop = element.scrollHeight;
        setTimeout(typeWriter, 10);
      }
    }
    
    typeWriter();
  }

  function appendToLog(text) {
    if (!logOutput) return;
    
    logOutput.textContent += text;
    logOutput.scrollTop = logOutput.scrollHeight;
    if (modalLogOutput) {
      modalLogOutput.textContent += text;
      modalLogOutput.scrollTop = modalLogOutput.scrollHeight;
    }
    
    // Add visual feedback for new content
    logOutput.style.borderLeft = '4px solid #667eea';
    setTimeout(() => {
      logOutput.style.borderLeft = '1px solid rgba(255,255,255,0.1)';
    }, 500);
  }

  // Auto-derive folder name with animation
  repositoryInput.addEventListener('input', () => {
    if (!folderManuallyEdited || folderInput.value.trim() === '') {
      const newValue = deriveFolderName(repositoryInput.value.trim());
      if (newValue !== folderInput.value) {
        folderInput.style.transform = 'scale(1.05)';
        folderInput.value = newValue;
        setTimeout(() => {
          folderInput.style.transform = 'scale(1)';
        }, 200);
      }
    }
  });

  folderInput.addEventListener('input', () => {
    folderManuallyEdited = folderInput.value.trim().length > 0;
  });

  // Enhanced preview with better UX
  previewButton.addEventListener('click', async () => {
    setStatus(promptStatus, 'Loading prompt...', 'info');
    promptOutput.textContent = '';
    previewButton.disabled = true;

    const repoDir = folderInput.value.trim() || undefined;
    const params = new URLSearchParams();
    if (repoDir) {
      params.set('repoDir', repoDir);
    }

    try {
      const response = await fetch(`/api/prompt?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.prompt) {
        animateOutput(promptOutput, data.prompt);
        setStatus(promptStatus, 'Prompt ready', 'success');
      } else {
        throw new Error('No prompt data received');
      }
    } catch (error) {
      console.error('Preview error:', error);
      promptOutput.textContent = `Error: ${error.message}`;
      setStatus(promptStatus, error.message, 'error');
    } finally {
      previewButton.disabled = false;
    }
  });

  // Enhanced run with real-time logging
  runForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    setStatus(runStatus, 'Initializing...', 'info');
    setPanelsCollapsed(true);
    logOutput.textContent = '';
    if (modalLogOutput) modalLogOutput.textContent = '';
    runButton.disabled = true;
    previewButton.disabled = true;

    const payload = {
      repository: repositoryInput.value.trim(),
      directory: directoryInput.value.trim(),
      folder: folderInput.value.trim() || undefined,
      force: forceInput.checked,
      dryRun: dryRunInput.checked,
    };

    // If not a dry-run, prefer streaming via SSE for real-time logs
    // Start artifacts monitoring for this run
    startFilesStream();

    if (!payload.dryRun && !!window.EventSource) {
      try {
        setStatus(runStatus, 'Running (streaming logs)...', 'info');

        // Close previous stream if any
        if (currentLogStream && typeof currentLogStream.close === 'function') {
          currentLogStream.close();
        }

        const params = new URLSearchParams();
        params.set('repository', payload.repository);
        if (payload.directory) params.set('directory', payload.directory);
        if (payload.folder) params.set('folder', payload.folder);
        if (payload.force) params.set('force', '1');

        const es = new EventSource(`/api/run-stream?${params.toString()}`);
        currentLogStream = es;

        es.onmessage = (e) => {
          appendToLog((e.data || '') + '\n');
        };

        es.addEventListener('end', (e) => {
          try {
            const data = JSON.parse(e.data || '{}');
            if (data.success) {
              setStatus(runStatus, 'Modernization completed', 'success');
              if (data.result?.prompt && promptOutput.textContent.trim() === '') {
                animateOutput(promptOutput, data.result.prompt);
                setStatus(promptStatus, 'Prompt derived from run', 'success');
              }
            } else {
              setStatus(runStatus, data.error || 'Run failed', 'error');
            }
          } catch (_) {
            setStatus(runStatus, 'Run finished', 'success');
          } finally {
            if (currentLogStream) currentLogStream.close();
            runButton.disabled = false;
            previewButton.disabled = false;
            setPanelsCollapsed(false);
          }
        });

        es.onerror = () => {
          // If the stream errors early, re-enable controls and show message
          setStatus(runStatus, 'Stream error', 'error');
          try { if (currentLogStream) currentLogStream.close(); } catch (_) {}
          runButton.disabled = false;
          previewButton.disabled = false;
          setPanelsCollapsed(false);
        };

        return; // Do not proceed with non-streaming path
      } catch (err) {
        // Fallback to non-streaming path
        console.warn('SSE not available, falling back to non-streaming:', err);
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3600000); // 1 hour timeout for actual runs

    try {
      setStatus(runStatus, 'Sending request...', 'info');
      console.log('Sending payload:', payload);
      
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setStatus(runStatus, 'Processing response...', 'info');
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      // Handle the response
      if (data.log) {
        if (payload.dryRun || data.log.length < 1000) {
          animateOutput(logOutput, data.log);
          if (modalLogOutput) animateOutput(modalLogOutput, data.log);
        } else {
          logOutput.textContent = data.log;
          logOutput.scrollTop = logOutput.scrollHeight;
          if (modalLogOutput) {
            modalLogOutput.textContent = data.log;
            modalLogOutput.scrollTop = modalLogOutput.scrollHeight;
          }
        }
      } else {
        logOutput.textContent = 'Process completed successfully.';
        if (modalLogOutput) modalLogOutput.textContent = 'Process completed successfully.';
      }

      const statusMessage = payload.dryRun ? 'Dry run completed' : 'Modernization completed';
      setStatus(runStatus, statusMessage, 'success');
      setPanelsCollapsed(false);
      
      if (data.result?.prompt && promptOutput.textContent.trim() === '') {
        animateOutput(promptOutput, data.result.prompt);
        setStatus(promptStatus, 'Prompt derived from run', 'success');
      }

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Run error:', error);
      
      if (error.name === 'AbortError') {
        logOutput.textContent = 'Request timed out after 5 minutes';
        if (modalLogOutput) modalLogOutput.textContent = 'Request timed out after 5 minutes';
        setStatus(runStatus, 'Request timeout', 'error');
      } else {
        logOutput.textContent = `Error: ${error.message}`;
        if (modalLogOutput) modalLogOutput.textContent = `Error: ${error.message}`;
        setStatus(runStatus, error.message, 'error');
      }
    } finally {
      runButton.disabled = false;
      previewButton.disabled = false;
      setPanelsCollapsed(false);
    }
  });

  // Start/refresh artifacts streaming watcher
  function startFilesStream() {
    if (!window.EventSource) return;
    const directory = directoryInput.value.trim() || './workspaces';
    const folder = folderInput.value.trim();
    if (!folder) return;

    // Close existing stream
    if (currentFilesStream && typeof currentFilesStream.close === 'function') {
      currentFilesStream.close();
    }

    const params = new URLSearchParams({ directory, folder, names: 'plan.md,review.md,changelog.md' });
    const es = new EventSource(`/api/files-stream?${params.toString()}`);
    currentFilesStream = es;

    if (artifactsStatus) setStatus(artifactsStatus, 'Monitoring files', 'info');

    es.addEventListener('artifact', async (e) => {
      try {
        const data = JSON.parse(e.data || '{}');
        const name = data.name;
        const status = data.status;
        const badge = name === 'plan.md' ? statusPlan : name === 'changelog.md' ? statusChangelog : statusReview;

        if (status === 'exists') {
          setBadge(badge, 'available', 'success');
          const prev = artifactStates[name] || { seen: false, mtime: 0 };
          const prevMtime = prev.mtime || 0;
          const newMtime = Number(data.mtime || 0);
          const firstSeen = !prev.seen;
          artifactStates[name] = { seen: true, mtime: newMtime };

          if (currentDocName === name) {
            // live refresh if opened
            try {
              const file = await fetchFile(name);
              docOutput.textContent = file.content || '';
              docOutput.scrollTop = docOutput.scrollHeight;
            } catch (_) {}
          }
          // Notify creation/update in the log
          if (firstSeen) {
            appendToLog(`📄 ${name} created\n`);
          } else if (newMtime && newMtime !== prevMtime) {
            appendToLog(`📄 ${name} updated\n`);
          }
        } else if (status === 'missing') {
          setBadge(badge, 'missing', 'warn');
          artifactStates[name] = { seen: false, mtime: 0 };
        } else if (status === 'error') {
          setBadge(badge, 'error', 'error');
        }
      } catch (_) {}
    });

    es.onerror = () => {
      if (artifactsStatus) setStatus(artifactsStatus, 'Artifacts stream error', 'error');
    };
  }

  // Restart artifacts monitoring when folder changes
  folderInput.addEventListener('blur', startFilesStream);
  directoryInput.addEventListener('blur', startFilesStream);

  // Add input validation with visual feedback
  function validateInput(input, isValid) {
    if (isValid) {
      input.style.borderColor = '#48bb78';
      input.style.boxShadow = '0 0 0 4px rgba(72, 187, 120, 0.1)';
    } else {
      input.style.borderColor = '#f56565';
      input.style.boxShadow = '0 0 0 4px rgba(245, 101, 101, 0.1)';
    }
    
    setTimeout(() => {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    }, 2000);
  }

  repositoryInput.addEventListener('blur', () => {
    const isValid = repositoryInput.value.trim() && 
                   (repositoryInput.value.includes('github.com') || 
                    repositoryInput.value.includes('gitlab.com') ||
                    repositoryInput.value.includes('.git'));
    validateInput(repositoryInput, isValid);
  });

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (!runButton.disabled) {
            runForm.dispatchEvent(new Event('submit'));
          }
          break;
        case 'p':
          e.preventDefault();
          if (!previewButton.disabled) {
            previewButton.click();
          }
          break;
      }
    }
  });

  // Modal controls
  function openLogModal() {
    if (!logModal) return;
    modalLogOutput.textContent = logOutput.textContent;
    logModal.classList.add('show');
    logModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      modalLogOutput.scrollTop = modalLogOutput.scrollHeight;
    }, 0);
  }

  function closeLogModal() {
    if (!logModal) return;
    logModal.classList.remove('show');
    logModal.setAttribute('aria-hidden', 'true');
  }

  if (maximizeLogBtn) maximizeLogBtn.addEventListener('click', openLogModal);
  if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLogModal);
  if (logModal) {
    logModal.addEventListener('click', (e) => {
      if (e.target === logModal) closeLogModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLogModal();
  });

  // Add tooltips for better UX
  const tooltips = {
    'repository': 'Enter a Git repository URL (GitHub, GitLab, etc.)',
    'directory': 'Local directory where the repository will be cloned',
    'folder': 'Custom name for the cloned repository folder',
    'force': 'Remove existing folder before cloning',
    'dry-run': 'Preview actions without executing them'
  };

  Object.entries(tooltips).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) {
      element.title = text;
    }
  });

  // Initialize with smooth entrance animation and connection check
  async function initializeApp() {
    try {
      // Check server connection
      const response = await fetch('/api/health');
      if (response.ok) {
        console.log('✅ Server connection established');
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      console.warn('⚠️ Server connection issue:', error.message);
      // Show a warning but don't block the UI
      setStatus(runStatus, 'Server connection issue - some features may not work', 'error');
    }
    
    // Show the UI
    document.body.style.opacity = '1';
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
  async function fetchFile(name) {
    const directory = directoryInput.value.trim() || './workspaces';
    const folder = folderInput.value.trim();
    const params = new URLSearchParams({ directory, folder, name });
    const res = await fetch(`/api/file?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function openDoc(name, title) {
    currentDocName = name;
    const tryLoad = async () => {
      try {
        const data = await fetchFile(name);
        docOutput.textContent = data.content || '';
        docModal.classList.add('show');
        docModal.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
          docOutput.scrollTop = docOutput.scrollHeight;
        }, 0);
      } catch (e) {
        docOutput.textContent = 'Not available yet.';
        docModal.classList.add('show');
        docModal.setAttribute('aria-hidden', 'false');
      }
      const header = document.getElementById('doc-modal-title');
      if (header) header.textContent = title || name;
    };
    tryLoad();
  }

  function closeDoc() {
    currentDocName = null;
    docModal.classList.remove('show');
    docModal.setAttribute('aria-hidden', 'true');
  }

  if (viewPlanBtn) viewPlanBtn.addEventListener('click', () => openDoc('plan.md', 'plan.md'));
  if (viewChangelogBtn) viewChangelogBtn.addEventListener('click', () => openDoc('changelog.md', 'changelog.md'));
  if (viewReviewBtn) viewReviewBtn.addEventListener('click', () => openDoc('review.md', 'review.md'));
  if (closeDocModalBtn) closeDocModalBtn.addEventListener('click', closeDoc);
  if (docModal) {
    docModal.addEventListener('click', (e) => { if (e.target === docModal) closeDoc(); });
  }

})();
