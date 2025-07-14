(async function() {
  const app = document.getElementById('app');

  const log = (...args)=>{ 
    const logElement = document.getElementById('log');
    logElement.innerHTML += `<div>${args.join(' ')}</div>`;
  };

  window.resetSettings = async () => {
    new Promise(async (resolve, reject) => {
      await Missive.storeSet('backend_config', {});
      await Missive.storeSet('backend_url', '');
      dataCache = {};
      emailsList = [];
      renderBackendForm();  
      resolve();
    }); 
  };

  function setContent(html){ app.innerHTML = `<div class="padding">${html}</div>`; }

  function renderError(container, message, showReset = false) {
    let html = `<div class="card">Error: ${message}`;
    if (showReset) {
      html += `<div class="row margin-top text-c"><a href="javascript:window.resetSettings();" class="button-secondary" style="text-decoration: none;">You can reset settings</a></div>`;
    }
    html += '</div>';
    
    if (container) {
      container.innerHTML = html;
    } else {
      setContent(html);
    }
  }

  function isValidUUIDv4(uuid) {
    const uuidv4Regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return uuidv4Regex.test(uuid);
  }

  if(!window.Missive){
    setContent('<div class="card">Missive SDK not loaded. Please ensure <code>missive.js</code> is reachable.</div>');
    return;
  }

  // Render form to ask for backend URL and save it
  function renderBackendForm(){
    setContent(`
      <div class="tabs-container">
        <div class="columns-middle">
          <div class="tabs light-box columns" id="backendTabs">
            <div class="tab tab--selected" data-tab="custom">Custom backend</div>
            <div class="tab tab" data-tab="hosted">Hosted backend</div>
          </div>
        </div>
      </div>

      <div class="tabs-content light-box padding">
        <div id="hostedTab" style="display: none;">
          <p class="text-normal section"><span class="text-600">Integration is not configured yet.</span> You need to setup a connection to Stripe. You can use our hosted backend. In that case you have to save you Stripe API key in our backend and get <a href="javascript:window.Missive.openURL('https://dashboard.extendkit.com/')">connection API key</a>.</p>
          <div class="section">
            <span class="text-label">API Key</span>
            <input id="apiKeyInput" type="text" placeholder="Your API key" style="width:100%;box-sizing:border-box;" />
            <div id="apiKeyError" style="color: red; font-size: 12px; margin-top: 4px; display: none;"></div>
          </div>
          <div class="row margin-top">
            <button id="saveHosted" class="button">Save &amp; use hosted backend</button>
          </div>
        </div>

        <div id="customTab">
        <div class="section">
          <p class="text-normal section"><span class="text-600">Integration is not configured yet.</span> You need to setup a connection to Stripe. You can use your own hosted backend proxy. Read <a href="javascript:window.Missive.openURL('https://extendkit.com/missive/stripe-backend/')">tutorial</a> how to setup your own backend proxy.</p>
          <div class="row section">
            <span class="text-label">Backend URL</span>
            <input id="backendUrlInput" type="text" placeholder="https://my-worker.example.com" style="width:100%;box-sizing:border-box;" />
          </div>
          <div class="row">
            <span class="text-label">Header Name</span>
            <input id="headerNameInput" type="text" placeholder="X-API-KEY" style="width:100%;box-sizing:border-box;" />
          </div>
          <div class="row">
            <span class="text-label">Header Value</span>
            <input id="headerValueInput" type="text" placeholder="Your secret value" style="width:100%;box-sizing:border-box;" />
          </div>
</div><div class="row margin-top">
            <button id="saveCustom" class="button">Save &amp; use custom backend</button>
          </div>
        </div>
      </div>
    </div>`);

    document.querySelectorAll('#backendTabs .tab').forEach(tabEl => {
      tabEl.addEventListener('click', () => {
        document.querySelectorAll('#backendTabs .tab').forEach(t => t.classList.remove('tab--selected'));
        tabEl.classList.add('tab--selected');
        const tabName = tabEl.dataset.tab;
        document.getElementById('hostedTab').style.display = tabName === 'hosted' ? 'block' : 'none';
        document.getElementById('customTab').style.display = tabName === 'custom' ? 'block' : 'none';
      });
    });

    document.getElementById('saveHosted').addEventListener('click', async () => await saveBackend('hosted'));
    document.getElementById('saveCustom').addEventListener('click', async () => await saveBackend('custom'));
  }

  async function saveBackend()
    {
      const selectedTab = document.querySelector('#backendTabs .tab--selected').dataset.tab;
      let config;

      if (selectedTab === 'hosted') {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const apiKeyError = document.getElementById('apiKeyError');
        apiKeyError.style.display = 'none';

        if (apiKey) {
          if (isValidUUIDv4(apiKey)) {
            config = { type: 'hosted', apiKey };
          } else {
            apiKeyError.textContent = 'Invalid API key format. Must be a valid UUIDv4 from our hosted backend. Don\'t put here a Stripe key. If you want to use your own backend, use the Custom Backend option and put your own URL and auth headers. Stripe key should be stored in your own backend in that case.';
            apiKeyError.style.display = 'block';
          }
        }
      } else {
        const url = document.getElementById('backendUrlInput').value.trim().replace(/\/+$/, '');
        const headerName = document.getElementById('headerNameInput').value.trim();
        const headerValue = document.getElementById('headerValueInput').value.trim();
        if (url && headerName && headerValue) {
          config = { type: 'custom', url, headerName, headerValue };
        }
      }

      if (config) {
        await Missive.storeSet('backend_config', config);
        initConversationListener();
      }
    }

  async function getBackendConfig() {
    const config = await Missive.storeGet('backend_config');
    if (!config) {
      renderBackendForm();
      return null;
    }
    return config;
  }

  function getBackendDetails(config) {
    if (config.type === 'hosted') {
      return {
        url: 'https://proxy.extendkit.com/stripe',
        authHeaders: { 'x-user-id': config.apiKey }
      };
    } else if (config.type === 'custom') {
      return {
        url: config.url,
        authHeaders: { [config.headerName]: config.headerValue }
      };
    }
    return null;
  }

  function getStripeHeaders(authHeaders) {
    return {
      'Content-Type': 'application/json',
      'Stripe-Version': '2020-08-27',
      ...authHeaders
    };
  }

  function checkError(jsonResponse){
    if (jsonResponse.error) throw new Error(jsonResponse.error.message);
  }

  async function ensureBackendURL(){
    const url = await Missive.storeGet('backend_url');
    if(!url){
      const config = await Missive.storeGet('backend_config');
      if (config && config.type === 'custom' && config.url) {
        await Missive.storeSet('backend_config', { ...config, headerName: 'x-user-id', headerValue: 'test' });
        return config;
      } else if (config) {
        return config;
      }
      renderBackendForm();
      return null;
    }

    await Missive.storeSet('backend_config', {
      type: 'custom',
      url: url,
      headerName: 'x-user-id',
      headerValue: 'test'
    });
    await Missive.storeDelete('backend_url');
    return ensureBackendURL();
  }

  async function fetchStripeData(email, backendDetails){
    try {
      const domain = email.split('@')[1];
      const headers = getStripeHeaders(backendDetails.authHeaders);

      const resCust = await fetch(`${backendDetails.url}/v1/customers/search?query=${encodeURIComponent(`email:"${email}" OR email~"${domain}"`)}`, { headers });
      if (!resCust.ok) throw new Error(`Failed to fetch customers (status: ${resCust.status})`);
      const custData = await resCust.json();
      checkError(custData);

      if (!custData?.data?.length) return { status: 'not_found' };

      const customers = custData.data;

      // if (customers.length === 1) {
      //   const id = customers[0].id;

      //   const resSubs = await fetch(`${backendDetails.url}/v1/subscriptions?customer=${encodeURIComponent(id)}`, { headers });
      //   const subsData = resSubs.ok ? await resSubs.json() : { data: [] };
      //   checkError(subsData);

      //   const resPay = await fetch(`${backendDetails.url}/v1/invoices?customer=${encodeURIComponent(id)}&status=paid`, { headers });
      //   const payData = resPay.ok ? await resPay.json() : { data: [] };
      //   checkError(payData);

      //   const productIds = subsData.data.flatMap(s => s.items.data.map(item => item.plan?.product)).filter(Boolean);
      //   const products = await fetchStripeProducts(productIds, backendDetails);

      //   return { status: 'ok', customers: [{ customer: customers[0], subscriptions: subsData.data, payments: payData.data, products: products }] };
      // }

      const detailedCustomers = [];
      for (const cust of customers) {
        try {
          const id = cust.id;

          const [resSubs, resPay] = await Promise.all([
            fetch(`${backendDetails.url}/v1/subscriptions?customer=${encodeURIComponent(id)}`, { headers }),
            fetch(`${backendDetails.url}/v1/invoices?customer=${encodeURIComponent(id)}&status=paid`, { headers })
          ]);

          const subsData = resSubs.ok ? await resSubs.json() : { data: [] };
          const payData = resPay.ok ? await resPay.json() : { data: [] };
          checkError(subsData);
          checkError(payData);

          const productIds = subsData.data.flatMap(s => s.items.data.map(item => item.plan?.product)).filter(Boolean);
          const products = productIds.length ? await fetchStripeProducts(productIds, backendDetails) : {};

          detailedCustomers.push({ customer: cust, subscriptions: subsData.data, payments: payData.data, products: products });
        } catch (_) {
          log('Failed to fetch details for customer', cust.id);
        }
      }

      return { status: 'ok', customers: detailedCustomers };
    } catch (err) {
      log(err);
      return { status: 'error', message: `Could not connect to Stripe. ${err.message}` };
    }
  }

  async function fetchStripeProducts(productIds, backendDetails) {
    const products = {};
    const headers = getStripeHeaders(backendDetails.authHeaders);
    await Promise.all([...new Set(productIds)].map(async (id) => {
      if (!id) return;
      try {
        const res = await fetch(`${backendDetails.url}/v1/products/${id}`, { headers });
        if (res.ok) {
          const productResponse = await res.json();
          checkError(productResponse);
          products[id] = productResponse;
        } else {
          log('Failed to fetch product', id, res.status);
        }
      } catch (e) {
        log('Error fetching product', id, e);
      }
    }));
    return products;
  }

  // ------------------------------------------------------------
  // State & UI helpers for email tabs
  // ------------------------------------------------------------

  let dataCache = {}; // cache Stripe results by email address
  let emailsList = []; // current conversation unique email list

  function renderData(result, selectedEmailObj){
    const container = document.getElementById('emailTabContent');
    if(!container){
      // Fallback (should not happen)
      setContent('<div class="card">Unable to render details.</div>');
      return;
    }

    if(result.status === 'not_found'){
      container.innerHTML = `<div class="card">No Stripe customer found for <strong>${selectedEmailObj.address}</strong>.</div>`;
      return;
    }

    if(result.status === 'error'){
      renderError(container, result.message, true);
      return;
    }

    // Helper to build customer detail HTML – extracted from previous implementation
    function buildCustomerHtml(customer, subscriptions, payments, products){
      let subsHtml = '<div class="columns-justify"><div class="text-d">None</div></div>';
      if(subscriptions && subscriptions.length){
        subsHtml = '';
        subscriptions.forEach(s => {
          subsHtml += `<div class="columns-justify">`;
          subsHtml += `<div class="padding-xsmall"><span style="display:block;">${s.items.data.map(i => {
            const productName = products && i.plan && i.plan.product && products[i.plan.product]
              ? products[i.plan.product].name
              : (i.plan?.nickname || i.plan?.id);
            return productName;
          }).join(', ')}</span><div><span class="code" style="font-size:10px;color:var(--missive-text-color-a);cursor:pointer;" title="Stripe Subscription ID - click to copy" onclick="window.Missive.writeToClipboard('${s.id}')">${s.id}</span></div></div>`;
          subsHtml += `<a href="javascript:window.Missive.openURL('https://dashboard.stripe.com/subscriptions/${s.id}')"><svg style="width: 16px; height: 16px;" id="external" viewBox="0 0 24 24">
                <path
                    d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z">
                </path>
            </svg></a>`;
          subsHtml += `</div>`;
        });
      }

      let payHtml = '<div class="columns-justify"><div class="text-d">None</div></div>';
      if(payments && payments.length){  
        payHtml = '';
        payments.forEach(p => {
          payHtml += `<div class="columns-justify padding-xsmall">`;
          payHtml += `<div>${(p.total/100).toFixed(2)} ${p.currency.toUpperCase()}<br/>${new Date(p.created*1000).toLocaleDateString()}</div>`;
          payHtml += `<a href="javascript:window.Missive.openURL('https://dashboard.stripe.com/invoices/${p.id}')"><svg style="width: 16px; height: 16px;" id="external" viewBox="0 0 24 24">
                <path
                    d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z">
                </path>
            </svg></a>`;
          payHtml += `</div>`;
        });
      }

      return `
        <div class="">
          <div class="row"><span class="text-label">Customer Name</span> <div class="columns-justify"><span>${customer.name || '<span class="text-d">None</span>'}</span><a href="javascript:window.Missive.openURL('https://dashboard.stripe.com/customers/${customer.id}');"><svg style="width: 16px; height: 16px;" id="external" viewBox="0 0 24 24">
                  <path
                      d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z">
                  </path>
              </svg></a></div>
              <span class="code" style="font-size:10px;color:var(--missive-text-color-a);cursor:pointer;" title="Stripe Customer ID - click to copy" onclick="window.Missive.writeToClipboard('${customer.id}')">${customer.id}</span>
              </div>
          <div class="row"><span class="text-label">Email</span> <div class="columns-justify"><span>${customer.email}</span></div></div>
          <!--<div class="row"><span class="text-label">Status:</span> <div class="columns-justify"><span>${customer.deleted ? 'Deleted' : 'Active'}</span></div></div>-->
        </div>
        <div class="">
          <span class="text-label">Subscriptions</span>
          <div class="row">${subsHtml}</div>
        </div>
        <div class="">
          <span class="text-label">Last Payments</span>
          <div class="row">${payHtml}</div>
        </div>`;
    }

    // ------------------------------------------------------------------
    // Multiple customers found
    // ------------------------------------------------------------------
    if(Array.isArray(result.customers)){
      const customersHtml = result.customers.map(({customer, subscriptions, payments, products}) => {
        return `<div class="card row">${buildCustomerHtml(customer, subscriptions, payments, products)}</div>`;
      }).join('');

      container.innerHTML = `<div>${customersHtml}</div>`;
      return; // all customers rendered
    }

    // ------------------------------------------------------------------
    // Single customer (existing behaviour)
    // ------------------------------------------------------------------
    //const { customer, subscriptions, payments, products } = result;

    //container.innerHTML = `<div class="row">${buildCustomerHtml(customer, subscriptions, payments, products)}</div>`;
  }

  async function loadEmail(emailObj){
    const container = document.getElementById('emailTabContent');
    if(!container) return;

    container.innerHTML = '<div class="card">Loading…</div>';

    if(dataCache[emailObj.address]){
      renderData(dataCache[emailObj.address], emailObj);
      return;
    }

    const backendConfig = await getBackendConfig();
    if (!backendConfig) { return; }

    const backendDetails = getBackendDetails(backendConfig);
    if (!backendDetails) {
      log('Invalid backend configuration.');
      renderBackendForm();
      return;
    }

    const result = await fetchStripeData(emailObj.address, backendDetails);
    dataCache[emailObj.address] = result;
    renderData(result, emailObj);
  }

  function renderTabHeader(emailObj){
    const header = document.getElementById('emailTabHeader');
    if(!header) return;
    header.innerHTML = `
      <div class="columns-middle">
        <span class="text-d margin-right-medium"><svg style="width: 34px; height: 34px;" viewBox="0 0 24 24"><path
                    d="M12,19.2C9.5,19.2 7.29,17.92 6,16C6.03,14 10,12.9 12,12.9C14,12.9 17.97,14 18,16C16.71,17.92 14.5,19.2 12,19.2M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z">
                </path></svg></span>
        <div class="column-grow ellipsis"><strong class="ellipsis">${emailObj.name}</strong>
        <div class="text-c ellipsis">${emailObj.address}</div>
      </div>
    `;
  }

  function renderTabsUI(emails, selectedAddress){
    const tabsHtml = emails.map(e => {
      const label = (e.name || e.address)[0].toUpperCase();
      const title = e.name ? `${e.name} <${e.address}>` : e.address;
      return `<div class="tab ${e.address === selectedAddress.address ? 'tab--selected' : ''}" data-email="${e.address}" title="${title}"><span>${label}</span></div>`;
    }).join('');

    setContent(`
      <div id="component">
          <div class="tabs-container">
            <div class="columns-middle">
              <div class="tabs light-box columns" id="emailTabs">
                ${tabsHtml}
              </div>
            </div>
            <div class="tabs-content light-box padding">
              <div id="emailTabHeader" class="margin-bottom">
                <div class="columns-middle">
                  <span class="text-d margin-right-medium"><svg style="width: 34px; height: 34px;" viewBox="0 0 24 24"><path
                    d="M12,19.2C9.5,19.2 7.29,17.92 6,16C6.03,14 10,12.9 12,12.9C14,12.9 17.97,14 18,16C16.71,17.92 14.5,19.2 12,19.2M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z">
                </path></svg></span>
                        <div class="column-grow ellipsis"><strong class="ellipsis">${selectedAddress.name}</strong>
                            <div class="text-c ellipsis">${selectedAddress.address}</div>
                        </div>
                  </div>
              </div>
              <div id="emailTabContent">
                <div class="card">Loading…</div>
              </div>
            </div>
          </div>
      </div>`);

    // Attach listeners after HTML is injected
    document.querySelectorAll('#emailTabs .tab').forEach(tabEl => {
      tabEl.addEventListener('click', () => {
        document.querySelectorAll('#emailTabs .tab').forEach(t => t.classList.remove('tab--selected'));
        tabEl.classList.add('tab--selected');
        const addr = tabEl.dataset.email;
        const emailObj = emails.find(e => e.address === addr);
        if(emailObj){
          loadEmail(emailObj);
          renderTabHeader(emailObj);
        }
      });
    });
  }

  async function handleConversationChange(ids){
    if(!ids || ids.length !== 1){
      setContent('<div class="card">Select a single conversation to see Stripe details.</div>');
      return;
    }

    const backendConfig = await getBackendConfig();
    if (!backendConfig) { return; }

    setContent('<div class="card">Loading…</div>');

    try{
      const conversations = await Missive.fetchConversations(ids);
      // const message = conversations[0].latest_message;
      // if(!message || !message.from_field){
      //   return;
      // }

      const emailObjs = Missive.getEmailAddresses(conversations);

      if(!emailObjs.length){
        setContent('<div class="card">No email address found in conversation!</div>');
        return;
      }

      dataCache = {};
      emailsList = emailObjs;

      renderTabsUI(emailObjs, emailObjs[0]);
      loadEmail(emailObjs[0]);
    }catch(e){
      log(e);
      renderError(null, 'Error while reading conversation.');
    }
  }

  function initConversationListener(){
    // Hook into Missive conversation changes immediately
    function extractIds(convs){
      if(!Array.isArray(convs)) return [];
      return convs.map(c=> (typeof c === 'string' ? c : c.id)).filter(Boolean);
    }

    // Listener triggered whenever selection changes in Missive
    Missive.on('change:conversations', convs => {
      const ids = extractIds(convs);
      handleConversationChange(ids);
    });

    // Run once with the current state if available
    if (Missive.state && Array.isArray(Missive.state.conversations)) {
      const currentIds = extractIds(Missive.state.conversations);
      if(currentIds.length){
        handleConversationChange(currentIds);
      }
    }
  }

  // bootstrap
  const config = await getBackendConfig();
  if (config) {
    initConversationListener();
  }
})(); 