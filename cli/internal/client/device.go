package client

// DeviceCodeStartIn matches POST /auth/device/code body.
type DeviceCodeStartIn struct {
	Label     string `json:"label,omitempty"`
	AgentType string `json:"agent_type,omitempty"`
}

// DeviceCodeStartOut matches POST /auth/device/code response.
type DeviceCodeStartOut struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`        // display form "ABCD-EFGH"
	VerificationURI string `json:"verification_uri"` // site URL to open
	ExpiresIn       int    `json:"expires_in"`       // seconds
	Interval        int    `json:"interval"`         // poll seconds
}

// DeviceCodePollIn matches POST /auth/device/poll body.
type DeviceCodePollIn struct {
	DeviceCode string `json:"device_code"`
}

// DeviceCodePollOut matches POST /auth/device/poll response.
type DeviceCodePollOut struct {
	Status  string `json:"status"`
	Token   string `json:"token,omitempty"`
	TokenID string `json:"token_id,omitempty"`
}

// DeviceCodeStart kicks off a device-code authorization. The returned
// `device_code` is the long secret the CLI uses to poll; `user_code` is
// the short string the user types in the browser.
func (c *Client) DeviceCodeStart(in DeviceCodeStartIn) (*DeviceCodeStartOut, error) {
	var out DeviceCodeStartOut
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/auth/device/code")
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errorFromResponse(resp)
	}
	return &out, nil
}

// DeviceCodePoll polls for the result of a device-code authorization.
// Returned status is one of "authorization_pending", "complete",
// "expired", "denied". On "complete", Token holds the plaintext gfp_…
// secret (one-shot — subsequent polls return "denied").
func (c *Client) DeviceCodePoll(deviceCode string) (*DeviceCodePollOut, error) {
	var out DeviceCodePollOut
	resp, err := c.r.R().
		SetBody(DeviceCodePollIn{DeviceCode: deviceCode}).
		SetResult(&out).
		Post("/auth/device/poll")
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errorFromResponse(resp)
	}
	return &out, nil
}
