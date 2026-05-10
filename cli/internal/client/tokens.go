package client

// TokenSummary mirrors backend ApiTokenOut.
type TokenSummary struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	AgentType   string  `json:"agent_type"`
	Prefix      string  `json:"prefix"`
	ScopesCSV   string  `json:"scopes_csv"`
	CreatedAt   string  `json:"created_at"`
	LastUsedAt  *string `json:"last_used_at"`
	ExpiresAt   *string `json:"expires_at"`
	RevokedAt   *string `json:"revoked_at"`
}

// TokenCreateIn matches the POST /tokens body.
type TokenCreateIn struct {
	Label         string   `json:"label"`
	AgentType     string   `json:"agent_type"`
	Scopes        []string `json:"scopes"`
	ExpiresInDays *int     `json:"expires_in_days,omitempty"`
}

// TokenCreateOut matches the POST /tokens response.
type TokenCreateOut struct {
	Token  TokenSummary `json:"token"`
	Secret string       `json:"secret"`
}

// ListTokens returns the caller's tokens.
func (c *Client) ListTokens() ([]TokenSummary, error) {
	var out []TokenSummary
	resp, err := c.r.R().SetResult(&out).Get("/tokens")
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errorFromResponse(resp)
	}
	return out, nil
}

// CreateToken issues a new token and returns the plaintext secret ONCE.
func (c *Client) CreateToken(in TokenCreateIn) (*TokenCreateOut, error) {
	var out TokenCreateOut
	resp, err := c.r.R().SetBody(in).SetResult(&out).Post("/tokens")
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, errorFromResponse(resp)
	}
	return &out, nil
}

// RevokeToken revokes a token by its UUID.
func (c *Client) RevokeToken(id string) error {
	resp, err := c.r.R().Delete("/tokens/" + id)
	if err != nil {
		return err
	}
	if resp.IsError() {
		return errorFromResponse(resp)
	}
	return nil
}
