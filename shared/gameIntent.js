// Clear requests and expressions go to conversation, never to scoring.
// The explicit “问小星” panel remains available for any phrasing not covered here.
export function isGameConversation(text) {
  return /提示|几个字|多少个字|几字|线索|帮帮|帮我|帮助|怎么|为什么|为何|能不能|可不可以|可以.*吗|告诉我|不知道|不认识|不会|不懂|好难|太难|有点难|很难|困难|累了|不想|不喜欢|休息|放弃|难过|害怕|谢谢|你好|再说|重复|听不清|[？?]/u.test(String(text))
}
