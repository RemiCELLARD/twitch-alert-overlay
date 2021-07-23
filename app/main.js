async function fetchOAuthToken(clientId, clientSecret) {
  try {
    let response = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      {method: 'POST'}
    );
    if(response.ok){
      let json = await response.json();
      return json['access_token'];
    }
    return null;
  } catch (err) {
    console.error(err);
  }
}

async function fetchUserId(login, clientId, OAuthToken) {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/users?login=${login}`,
      {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${OAuthToken}`}
      }
    );
    const json = await response.json();
    return json.data[0].id;
  } catch (err) {
    console.error(err);
  }
}

async function fetchFollowerIds(userId, clientId, OAuthToken) {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/users/follows?to_id=${userId}&first=100`,
      {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${OAuthToken}`}
      }
    );
    const json = await response.json();
    return json.data.map((x) => x.from_id);
  } catch (err) {
    console.error(err);
  }
}

async function fetchFollowerDetails(followerIds, clientId, OAuthToken) {
  try {
    const followersString = followerIds.map((id) => `id=${id}`).join("&");
    const response = await fetch(
      `https://api.twitch.tv/helix/users?${followersString}`,
      {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${OAuthToken}`}
      }
    );
    const json = await response.json();
    return json.data;
  } catch (err) {
    console.error(err);
  }
}

function configureSound(name, volume) {
  const sound = document.getElementById("alert-sound");
  sound.src = `sounds/${name}.wav`;
  sound.volume = volume / 100;
  return sound;
}

function buildAlert(detail) {
  return `
  <div class="alert">
    <img
      class="profile-picture"
      src="${detail.profile_image_url}"
    />
    <div class="name-group">
      <div class="followed-by">&#x1F90D; Followed By</div>
      <div class="display-name">${detail.display_name}</div>
    </div>
  </div>`;
}

async function startOverlay() {
  try {    
    const params = new URLSearchParams(location.search);
    const login = params.get("login") || "joekombo";
    const sound = params.get("sound") || "guitar";
    const volume = Number(params.get("volume") || "50");
    const clientId = params.get("clientid");
    const clientSecret = params.get("clientsecret");
    const gif = params.get("gif") || "guitarkitty";
    const soundClip = configureSound(sound, volume);
    
    if (!clientId || !clientSecret) {
      document.body.innerHTML = `
      <div class='instructions'>
      <h1>MISSING CLIENT ID / CLIENT SECRET</h1>
      <p>Go to <a href="https://github.com/joekombo/twitch-alert-overlay">
      https://github.com/joekombo/twitch-alert-overlay</a> for detailed instructions.</p>
        </div>
        `;
      return;
    }

    /* Init variables */
    const OAuthToken = await fetchOAuthToken(clientId, clientSecret);
    const userId = await fetchUserId(login, clientId, OAuthToken);
    const initialFollowerIds = await fetchFollowerIds(userId, clientId, OAuthToken);
     
    /* Initial list of followers */
    let knownFollowersIds = initialFollowerIds;

    setInterval(async () => {
      const followerIds = await fetchFollowerIds(userId, clientId, OAuthToken);
      let newFollowersIds = [];

      followerIds.forEach((id) => {
        if (!knownFollowersIds.includes(id)) {
          knownFollowersIds.push(id);
          newFollowersIds.push(id);
        }
      });

      if (newFollowersIds.length) {
        const followerDetails = await fetchFollowerDetails(newFollowersIds, clientId, OAuthToken);

        let remainingDetails = followerDetails;

        let alertLoopInterval = setInterval(() => {
          let first15Alerts = remainingDetails
            .splice(0, 15)
            .map((detail) => buildAlert(detail));

          soundClip.play();

          document.getElementById("alerts").innerHTML = `
            <div id='alerts-frame'>
              ${first15Alerts.join("")}
            </div>
            <img id='gif' src='images/${gif}.gif' />
            `;

          if (remainingDetails.length <= 0) {
            clearInterval(alertLoopInterval);
          }

          console.log(`Remaining alerts: ${remainingDetails.length}`);
        }, 5000);
      }
    }, 15000);
  } catch (err) {
    console.error(err);
  }
}

startOverlay();
