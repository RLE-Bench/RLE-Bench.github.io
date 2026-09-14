(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const labels = { draft: 'Draft', uploading: 'Upload incomplete', submitted: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested', accepted: 'Accepted', declined: 'Declined' };
  const isReview = location.pathname.startsWith('/review');
  const isProposal = ['/propose', '/review/proposals'].includes(location.pathname);
  const endpoint = isProposal ? '/api/proposals' : '/api/submissions';
  let current, pending, cursor, detail, proposalEditing, proposalPending, proposalDirty = false, listRequest = 0, detailRequest = 0;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const date = timestamp => new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const checksum = async file => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), x => x.toString(16).padStart(2, '0')).join('');
  function theme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    $('themeToggle').textContent = next === 'light' ? 'Light' : 'Dark';
    $('themeToggle').setAttribute('aria-label', `Switch to ${next} theme`);
  }
  theme();
  $('themeToggle').addEventListener('click', () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('rlebench-theme', document.documentElement.dataset.theme); } catch { /* Optional. */ }
    theme();
  });
  $(isReview ? 'reviewNav' : isProposal ? 'proposalNav' : 'submitNav').setAttribute('aria-current', 'page');
  $('signinLink').href = `/auth/github?return=${encodeURIComponent(location.pathname)}`;
  $('reviewNav').href = isProposal ? '/review/proposals' : '/review';
  if (isProposal) {
    document.title = 'Propose a task · RLE-Bench';
    $('pageTitle').textContent = 'Propose a task';
    $('pageIntro').textContent = 'Share a robotics engineering problem and how you would evaluate it. Get feedback on the idea before preparing a complete task package.';
    $('signinDescription').textContent = 'Sign in to save a draft, submit a proposal, and follow its review.';
    $('listHeading').textContent = 'Your proposals';
    if (!isReview) $('statusFilter').append(new Option('Draft', 'draft'));
  }
  if (isReview) {
    document.title = `${isProposal ? 'Review proposals' : 'Review tasks'} · RLE-Bench`;
    $('pageTitle').textContent = isProposal ? 'Review proposals' : 'Review tasks';
    $('pageIntro').textContent = isProposal ? 'Assess the problem, feasibility, and evaluation plan. Proposal acceptance is separate from review of a finished task.' : 'Review completed task packages, validation evidence, and evaluation results.';
    $('listHeading').textContent = isProposal ? 'Submitted proposals' : 'Submitted tasks';
    $('signinDescription').textContent = 'Sign in with a reviewer account to view submissions and leave feedback.';
    $(isProposal ? 'proposalQueue' : 'taskQueue').setAttribute('aria-current', 'page');
  }
  function signedOutMessage() {
    $('signinPanel').hidden = false;
    $('signinLink').hidden = !current?.authReady;
    $('notice').textContent = 'Your session has expired. Sign in again, then retry your submission.';
    // Keep form values and the selected file until the user chooses to navigate.
  }
  async function api(path, { method = 'GET', data } = {}) {
    const response = await fetch(path, {
      method, credentials: 'same-origin',
      headers: data === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': current?.csrfToken || '' },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    let value;
    try { value = await response.json(); } catch { throw new Error('The service returned an unexpected response. Please try again.'); }
    if (response.status === 401) signedOutMessage();
    if (!response.ok) throw new Error(value.error || 'The request could not be completed.');
    return value;
  }
  function upload(id, file, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/submissions/${id}/archive`);
      xhr.timeout = 180000;
      xhr.setRequestHeader('Content-Type', 'application/zip');
      xhr.setRequestHeader('X-CSRF-Token', current.csrfToken);
      xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch { reject(new Error('Unexpected upload response. Retry with the same file.')); return; }
        if (xhr.status === 401) signedOutMessage();
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed. Retry with the same file.'));
      };
      xhr.onerror = xhr.ontimeout = () => reject(new Error('Upload interrupted. Your form is still here; retry with the same file.'));
      xhr.send(file);
    });
  }
  function checkFile(file) {
    if (!file || !/\.zip$/i.test(file.name)) throw new Error('Choose a ZIP archive.');
    if (file.size < 22 || file.size > current.maxUploadBytes) throw new Error(`Choose a ZIP no larger than ${current.maxUploadBytes / 1048576} MiB.`);
  }
  function badge(status) {
    const node = element('span', labels[status] || status, 'badge');
    node.dataset.status = status;
    return node;
  }
  async function loadList(append = false) {
    const requestId = ++listRequest;
    $('loadMore').disabled = true;
    $('listStatus').textContent = 'Loading submissions…';
    try {
      const params = new URLSearchParams({ scope: isReview ? 'review' : 'mine' });
      if ($('statusFilter').value) params.set('status', $('statusFilter').value);
      if (append && cursor) params.set('before', cursor);
      const data = await api(`${endpoint}?${params}`);
      if (requestId !== listRequest) return;
      if (!append) $('submissionList').replaceChildren();
      for (const row of data.submissions) {
        const container = element('article', null, 'submission-row'), copy = element('div');
        copy.append(element('h3', row.title), element('p', `${isProposal ? 'Proposal' : row.version} · @${row.login} · ${date(row.created_at)}`));
        const open = element('button', 'Details', 'quiet');
        open.type = 'button';
        open.setAttribute('aria-label', `View ${row.title}`);
        open.addEventListener('click', () => showDetail(row.id));
        container.append(copy, badge(row.status), open);
        $('submissionList').append(container);
      }
      cursor = data.next;
      $('loadMore').hidden = !cursor;
      $('listStatus').textContent = $('submissionList').childElementCount ? '' : isReview ? 'No submissions match this view.' : isProposal ? 'Saved drafts and submitted proposals will appear here.' : 'Your tasks will appear here after you start an upload.';
    } catch (error) { if (requestId === listRequest) $('listStatus').textContent = error.message; }
    finally { if (requestId === listRequest) $('loadMore').disabled = false; }
  }
  $('submissionForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('submitButton').disabled = true;
    $('uploadStatus').classList.remove('error');
    $('uploadProgress').hidden = true;
    try {
      const form = new FormData(event.currentTarget), file = $('archive').files[0];
      checkFile(file);
      $('uploadStatus').textContent = 'Checking your file…';
      const data = Object.fromEntries(['title', 'version', 'workflow', 'summary', 'contact'].map(key => [key, String(form.get(key)).trim()]));
      Object.assign(data, { filename: file.name, byte_size: file.size, sha256: await checksum(file) });
      const fingerprint = JSON.stringify(data);
      if (pending?.fingerprint !== fingerprint) pending = { id: crypto.randomUUID(), fingerprint };
      const created = await api('/api/submissions', { method: 'POST', data: { ...data, id: pending.id } });
      if (created.status === 'uploading') {
        $('uploadProgress').value = 0;
        $('uploadProgress').hidden = false;
        $('uploadStatus').textContent = 'Uploading your task…';
        await upload(created.id, file, percent => {
          $('uploadProgress').value = percent;
          if (percent === 100) $('uploadStatus').textContent = 'Checking package structure and saving your submission…';
        });
      }
      $('uploadStatus').textContent = `Task submitted. Your reference is ${created.id}.`;
      event.target.reset();
      pending = null;
      await loadList();
    } catch (error) { $('uploadStatus').textContent = error.message; $('uploadStatus').classList.add('error'); }
    finally { $('submitButton').disabled = false; $('uploadProgress').hidden = true; }
  });
  function resetProposal() {
    $('proposalForm').reset();
    proposalEditing = proposalPending = null;
    proposalDirty = false;
    $('proposalHeading').textContent = 'Your proposal';
    $('proposalSubmit').textContent = 'Submit proposal';
    $('proposalSave').textContent = 'Save draft';
    $('proposalCancel').hidden = true;
  }
  function editProposal(row) {
    if (proposalDirty && !confirm('Discard the unsaved changes in the proposal editor?')) return;
    for (const [name, value] of Object.entries(row.fields)) {
      const input = $('proposalForm').elements.namedItem(name);
      if (input) input.value = value;
    }
    proposalEditing = { id: row.id, revision: row.revision };
    proposalPending = null;
    proposalDirty = false;
    $('proposalHeading').textContent = row.status === 'draft' ? 'Edit your draft' : 'Revise your proposal';
    $('proposalStatus').textContent = row.status === 'draft' ? 'Draft loaded. Finish the required fields when you are ready to submit.' : 'Update the proposal using the feedback below, then resubmit it for review.';
    $('proposalSubmit').textContent = row.status === 'draft' ? 'Submit proposal' : 'Resubmit proposal';
    $('proposalSave').textContent = row.status === 'draft' ? 'Save draft' : 'Save changes';
    $('proposalCancel').hidden = false;
    $('detailDialog').close();
    $('proposalTitle').focus();
  }
  $('proposalForm').addEventListener('input', () => { proposalDirty = true; });
  window.addEventListener('beforeunload', event => {
    if (proposalDirty) { event.preventDefault(); event.returnValue = ''; }
  });
  $('proposalCancel').addEventListener('click', () => {
    if (proposalDirty && !confirm('Discard the unsaved changes in the proposal editor?')) return;
    resetProposal();
    $('proposalStatus').textContent = '';
  });
  $('proposalForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, status = event.submitter?.value || 'submitted';
    const fields = Object.fromEntries(Array.from(new FormData(form), ([name, value]) => [name, String(value).trim()]));
    if (fields.title.length < 3) { $('proposalStatus').textContent = 'Enter a task name of at least 3 characters to save a draft.'; $('proposalTitle').focus(); return; }
    const controls = Array.from(form.querySelectorAll('input,select,textarea,button'));
    controls.forEach(control => { control.disabled = true; });
    $('proposalStatus').textContent = status === 'draft' ? 'Saving your proposal…' : 'Submitting your proposal…';
    try {
      let result;
      if (proposalEditing) {
        result = await api(`/api/proposals/${proposalEditing.id}`, { method: 'PUT', data: { fields, status, revision: proposalEditing.revision } });
      } else {
        const fingerprint = JSON.stringify({ fields, status });
        if (proposalPending?.fingerprint !== fingerprint) proposalPending = { id: crypto.randomUUID(), fingerprint };
        result = await api('/api/proposals', { method: 'POST', data: { id: proposalPending.id, fields, status } });
      }
      proposalPending = null;
      proposalDirty = false;
      if (['draft', 'changes_requested'].includes(result.status)) {
        proposalEditing = { id: result.id, revision: result.revision };
        $('proposalCancel').hidden = false;
        $('proposalStatus').textContent = 'Saved. You can return to this proposal from the list below.';
      } else {
        resetProposal();
        $('proposalStatus').textContent = `Proposal submitted for review. Your reference is ${result.id}.`;
      }
      await loadList();
    } catch (error) { $('proposalStatus').textContent = error.message; }
    finally { controls.forEach(control => { control.disabled = false; }); }
  });
  function renderProposalDetail() {
    const fields = detail.fields, list = element('dl');
    for (const [label, value] of [['Contributor', `@${detail.login}`], ['Domain', fields.domain], ['Software', fields.software], ['Contact', fields.contact], ['Created', date(detail.created_at)], ['Reference', detail.id]]) {
      if (value) list.append(element('dt', label), element('dd', value));
    }
    $('detailContent').append(badge(detail.status), list);
    for (const [name, label] of [['description', 'Task description'], ['input_materials', 'Input materials'], ['reference_output', 'Reference output'], ['evaluation', 'How success is verified'], ['self_test_model', 'Self-test model'], ['self_test_harness', 'Agent harness'], ['self_test_score', 'Self-test outcome']]) {
      if (fields[name]) $('detailContent').append(element('h3', label), element('p', fields[name], 'pre-wrap'));
    }
    for (const [name, label] of [['materials_url', 'Input materials'], ['reference_url', 'Reference output'], ['evidence_url', 'Self-test evidence']]) {
      if (!fields[name]) continue;
      const url = new URL(fields[name]);
      if (url.protocol !== 'https:') continue;
      const link = element('a', `${label} ↗ (${url.hostname})`, 'text-link');
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      $('detailContent').append(link);
    }
    if (detail.github_id === current.user.id && ['draft', 'changes_requested'].includes(detail.status)) {
      const edit = element(isReview ? 'a' : 'button', detail.status === 'draft' ? 'Continue draft' : 'Revise proposal', 'button');
      if (isReview) edit.href = `/propose?edit=${detail.id}`;
      else { edit.type = 'button'; edit.addEventListener('click', () => editProposal(detail)); }
      $('detailContent').append(edit);
    }
    if (detail.status === 'accepted') {
      $('detailContent').append(element('p', 'The proposal is accepted. Prepare a complete task package for a separate task review.', 'field-help'));
      const task = element('a', 'Submit a finished task', 'text-link'); task.href = '/submit'; $('detailContent').append(task);
    }
  }
  async function showDetail(id) {
    const requestId = ++detailRequest;
    $('detailTitle').textContent = 'Submission';
    $('detailStatus').textContent = 'Loading…';
    $('detailContent').replaceChildren();
    $('reviewForm').hidden = $('resumeForm').hidden = true;
    if (!$('detailDialog').open) $('detailDialog').showModal();
    try {
      const data = await api(`${endpoint}/${id}`);
      if (requestId !== detailRequest) return;
      detail = data.submission;
      $('detailTitle').textContent = detail.title;
      $('detailStatus').textContent = '';
      if (isProposal) renderProposalDetail();
      else {
        const list = element('dl');
        for (const [label, value] of [['Contributor', `@${detail.login}`], ['Version', detail.version], ['Workflow', detail.workflow], ['Contact', detail.contact], ['Created', date(detail.created_at)], ['Archive', `${detail.filename} · ${(detail.byte_size / 1048576).toFixed(2)} MiB`], ['Reference', detail.id]]) {
          list.append(element('dt', label), element('dd', value));
        }
        $('detailContent').append(badge(detail.status), list, element('h3', 'Engineering problem and evaluation'), element('p', detail.summary, 'pre-wrap'));
        if (detail.status !== 'uploading') {
          const download = element('a', 'Download ZIP', 'button');
          download.href = `/api/submissions/${detail.id}/archive`;
          $('detailContent').append(download);
        }
      }
      if (data.reviews.length) {
        $('detailContent').append(element('h3', 'Review history'));
        for (const review of data.reviews) {
          const entry = element('div', null, 'review-entry');
          entry.append(badge(review.status), element('p', `@${review.login} · ${date(review.created_at)}`, 'metadata'));
          if (review.note) entry.append(element('p', review.note, 'pre-wrap'));
          $('detailContent').append(entry);
        }
      }
      if (detail.status === 'uploading' && detail.github_id === current.user.id) {
        $('resumeForm').reset();
        $('resumeForm').hidden = false;
      }
      if (current.user.reviewer && !['uploading', 'draft'].includes(detail.status)) {
        $('reviewForm').reset();
        $('reviewStatus').value = detail.status;
        $('reviewForm').hidden = false;
      }
    } catch (error) { if (requestId === detailRequest) $('detailStatus').textContent = error.message; }
  }
  $('resumeForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      const file = $('resumeArchive').files[0];
      checkFile(file);
      if (file.size !== detail.byte_size || await checksum(file) !== detail.sha256) throw new Error('Select the same ZIP you used when starting this submission.');
      $('detailStatus').textContent = 'Uploading your task…';
      await upload(detail.id, file);
      await showDetail(detail.id);
      await loadList();
    } catch (error) { $('detailStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('reviewForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    $('detailStatus').textContent = 'Saving review…';
    try {
      await api(`${endpoint}/${detail.id}/review`, { method: 'POST', data: { status: $('reviewStatus').value, note: $('reviewNote').value, ...(isProposal ? { revision: detail.revision } : {}) } });
      await showDetail(detail.id);
      $('detailStatus').textContent = 'Review saved.';
      await loadList();
    } catch (error) { $('detailStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('closeDialog').addEventListener('click', () => $('detailDialog').close());
  $('detailDialog').addEventListener('close', () => { detailRequest++; });
  $('statusFilter').addEventListener('change', () => loadList());
  $('refreshList').addEventListener('click', () => loadList());
  $('loadMore').addEventListener('click', () => loadList(true));
  $('logout').addEventListener('click', async () => {
    $('logout').disabled = true;
    try { await api('/api/logout', { method: 'POST', data: {} }); location.assign(isProposal ? '/propose' : '/submit'); }
    catch (error) { $('notice').textContent = error.message; $('logout').disabled = false; }
  });
  async function initialize() {
    try {
      current = await api('/api/session');
      $('notice').textContent = '';
      const auth = new URL(location.href).searchParams.get('auth');
      if (auth) {
        $('notice').textContent = auth === 'cancelled' ? 'GitHub sign-in was cancelled. You can try again when ready.' : 'GitHub sign-in could not be completed. Please try again.';
        history.replaceState(null, '', location.pathname);
      }
      if (!current.user) {
        $('signinPanel').hidden = false;
        if (!current.authReady) { $('signinLink').hidden = true; $('notice').textContent = 'GitHub sign-in is being configured. Please check back shortly.'; }
        return;
      }
      $('accountBar').hidden = false;
      $('accountLogin').textContent = '@' + current.user.login;
      $('reviewNav').hidden = !current.user.reviewer;
      $('archiveHelp').textContent = `ZIP up to ${current.maxUploadBytes / 1048576} MiB. Include your completed SUBMISSION.md and task/ directory at the ZIP root.`;
      if (isReview && !current.user.reviewer) { $('notice').textContent = 'This account does not have reviewer access. Use Submit to contribute your own task.'; return; }
      $('contributorContent').hidden = isReview || isProposal;
      $('proposalContent').hidden = isReview || !isProposal;
      $('reviewTabs').hidden = !isReview;
      $('submissionsSection').hidden = false;
      await loadList();
      const editId = new URL(location.href).searchParams.get('edit');
      if (isProposal && !isReview && editId) {
        const { submission } = await api(`/api/proposals/${encodeURIComponent(editId)}`);
        if (submission.github_id === current.user.id && ['draft', 'changes_requested'].includes(submission.status)) editProposal(submission);
        history.replaceState(null, '', location.pathname);
      }
    } catch (error) { $('notice').textContent = error.message; }
  }
  initialize();
})();
