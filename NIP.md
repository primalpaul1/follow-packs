# Follow Pack (kind 39089)

Follow Packs are published as Nostr events with `kind: 39089`. This is a parameterized replaceable event (addressable event) that allows users to maintain multiple follow lists.

This schema is compatible with [following.space](https://following.space) by [@callebtc](https://github.com/callebtc/following.space).

## Event Structure

```json
{
  "kind": 39089,
  "pubkey": "<public key of the list creator>",
  "created_at": 1234567890,
  "tags": [
    ["title", "List Title"],
    ["d", "<unique identifier>"],
    ["image", "https://..."],
    ["description", "A description of the follow pack"],
    ["p", "<pubkey1>"],
    ["p", "<pubkey2>"]
  ],
  "content": "",
  "sig": "..."
}
```

## Tag Descriptions

| Tag | Required | Description |
|-----|----------|-------------|
| `title` | Yes | The name/title of the Follow Pack |
| `d` | Yes | A unique identifier (alphanumeric string), enables replaceability |
| `image` | No | URL to a cover image for the list |
| `description` | No | Text description of the Follow Pack |
| `p` | Yes (1+) | Public key (hex) of each user included in the list |

## Notes

- Kind 39089 is an addressable (parameterized replaceable) event, identified by the combination of `pubkey` + `kind` + `d` tag
- To update a list, publish a new event with the same `kind`, `pubkey`, and `d` tag but a newer `created_at` timestamp
- The `content` field is always empty
- Multiple `p` tags are used to represent all users in the pack
