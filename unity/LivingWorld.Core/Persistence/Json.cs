using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace LivingWorld.Core.Persistence
{
    /// <summary>
    /// 최소 JSON 트리 + 결정론적 직렬화.
    ///
    /// 왜 라이브러리를 쓰지 않는가:
    /// - <c>UnityEngine.JsonUtility</c>는 Dictionary도, 다형 배열도, "값이 없으면 키를 빼는 것"도
    ///   못 한다. Snapshot에는 세 가지가 다 있다.
    /// - Newtonsoft를 넣으면 코어가 패키지에 의존하게 되고, 기본 설정으로는 키 순서와 숫자 표기가
    ///   TS의 <c>JSON.stringify</c>와 일치하지 않는다.
    ///
    /// 우리가 필요한 것은 "TS가 저장한 세이브와 **바이트가 같은** 세이브"다. 그 조건은
    /// 규칙이 몇 개 안 되므로 직접 쓰는 편이 검증하기 쉽다:
    /// - 객체 키는 UTF-16 코드 단위 순서로 정렬 (JS <c>Array.prototype.sort</c> 기본과 동일)
    /// - 들여쓰기 2칸, 빈 객체/배열은 <c>{}</c> / <c>[]</c>
    /// - 숫자는 불필요한 0을 붙이지 않는다 (<see cref="JsMath.Str"/>)
    /// - ASCII 밖 문자는 이스케이프하지 않는다 (JSON.stringify와 동일 — 한글이 그대로 들어간다)
    /// </summary>
    public abstract class JsonValue
    {
        public static JsonValue Of(string value) =>
            value == null ? (JsonValue)JsonNull.Instance : new JsonString(value);

        public static JsonValue Of(double value) => new JsonNumber(value);
        public static JsonValue Of(bool value) => new JsonBool(value);

        /// <summary>2칸 들여쓰기 직렬화. TS <c>serialize(snapshot)</c>와 바이트가 같다.</summary>
        public string ToJson()
        {
            var sb = new StringBuilder();
            Write(sb, 0);
            return sb.ToString();
        }

        internal abstract void Write(StringBuilder sb, int depth);

        /* ───────── 읽기 도우미 — 없는 키를 조용히 0으로 만들지 않는다 ───────── */

        public JsonObject AsObject() =>
            this as JsonObject ?? throw new FormatException($"객체가 아니다: {GetType().Name}");

        public JsonArray AsArray() =>
            this as JsonArray ?? throw new FormatException($"배열이 아니다: {GetType().Name}");

        public string AsString() =>
            this is JsonString s ? s.Value : throw new FormatException($"문자열이 아니다: {GetType().Name}");

        public double AsDouble() =>
            this is JsonNumber n ? n.Value : throw new FormatException($"숫자가 아니다: {GetType().Name}");

        public int AsInt() => (int)AsDouble();
        public uint AsUInt() => (uint)AsDouble();
    }

    public sealed class JsonNull : JsonValue
    {
        public static readonly JsonNull Instance = new JsonNull();
        private JsonNull() { }
        internal override void Write(StringBuilder sb, int depth) => sb.Append("null");
    }

    public sealed class JsonBool : JsonValue
    {
        public bool Value { get; }
        public JsonBool(bool value) => Value = value;
        internal override void Write(StringBuilder sb, int depth) => sb.Append(Value ? "true" : "false");
    }

    public sealed class JsonNumber : JsonValue
    {
        public double Value { get; }
        public JsonNumber(double value) => Value = value;
        internal override void Write(StringBuilder sb, int depth) => sb.Append(JsMath.Str(Value));
    }

    public sealed class JsonString : JsonValue
    {
        public string Value { get; }
        public JsonString(string value) => Value = value;

        internal override void Write(StringBuilder sb, int depth) => Escape(sb, Value);

        /// <summary>JSON.stringify와 같은 범위만 이스케이프한다.</summary>
        internal static void Escape(StringBuilder sb, string value)
        {
            sb.Append('"');
            foreach (char c in value)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                            sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else
                            sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }
    }

    /// <summary>
    /// 키가 항상 정렬돼 보관되는 객체. 넣는 순서가 바이트에 영향을 주지 않는다 —
    /// "필드를 추가했더니 세이브 비교가 깨졌다"를 원천적으로 막는다.
    /// </summary>
    public sealed class JsonObject : JsonValue, IEnumerable<KeyValuePair<string, JsonValue>>
    {
        private readonly SortedDictionary<string, JsonValue> _fields =
            new SortedDictionary<string, JsonValue>(StringComparer.Ordinal);

        public int Count => _fields.Count;

        public JsonObject Set(string key, JsonValue value)
        {
            _fields[key] = value ?? JsonNull.Instance;
            return this;
        }

        public JsonObject Set(string key, string value) => Set(key, Of(value));
        public JsonObject Set(string key, double value) => Set(key, Of(value));
        public JsonObject Set(string key, bool value) => Set(key, Of(value));

        /// <summary>
        /// TS의 <c>undefined</c> 필드와 같게: 값이 없으면 **키 자체를 쓰지 않는다.**
        /// null을 쓰면 바이트가 달라진다.
        /// </summary>
        public JsonObject SetIfPresent(string key, JsonValue value)
        {
            if (value != null) _fields[key] = value;
            return this;
        }

        public bool Has(string key) => _fields.ContainsKey(key);

        public JsonValue Get(string key) =>
            _fields.TryGetValue(key, out var v) ? v : throw new FormatException($"키 없음: {key}");

        /// <summary>없으면 null. 있는지 없는지가 의미를 갖는 필드에만 쓴다.</summary>
        public JsonValue Optional(string key) =>
            _fields.TryGetValue(key, out var v) && !(v is JsonNull) ? v : null;

        public IEnumerator<KeyValuePair<string, JsonValue>> GetEnumerator() => _fields.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        internal override void Write(StringBuilder sb, int depth)
        {
            if (_fields.Count == 0) { sb.Append("{}"); return; }
            sb.Append("{\n");
            bool first = true;
            foreach (var pair in _fields)
            {
                if (!first) sb.Append(",\n");
                first = false;
                Indent(sb, depth + 1);
                JsonString.Escape(sb, pair.Key);
                sb.Append(": ");
                pair.Value.Write(sb, depth + 1);
            }
            sb.Append('\n');
            Indent(sb, depth);
            sb.Append('}');
        }

        internal static void Indent(StringBuilder sb, int depth) => sb.Append(' ', depth * 2);
    }

    public sealed class JsonArray : JsonValue, IEnumerable<JsonValue>
    {
        private readonly List<JsonValue> _items = new List<JsonValue>();

        public int Count => _items.Count;
        public JsonValue this[int index] => _items[index];

        public JsonArray Add(JsonValue value)
        {
            _items.Add(value ?? JsonNull.Instance);
            return this;
        }

        public static JsonArray Of<T>(IEnumerable<T> items, Func<T, JsonValue> map)
        {
            var array = new JsonArray();
            foreach (var item in items) array.Add(map(item));
            return array;
        }

        public IEnumerator<JsonValue> GetEnumerator() => _items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        internal override void Write(StringBuilder sb, int depth)
        {
            if (_items.Count == 0) { sb.Append("[]"); return; }
            sb.Append("[\n");
            for (int i = 0; i < _items.Count; i += 1)
            {
                if (i > 0) sb.Append(",\n");
                JsonObject.Indent(sb, depth + 1);
                _items[i].Write(sb, depth + 1);
            }
            sb.Append('\n');
            JsonObject.Indent(sb, depth);
            sb.Append(']');
        }
    }

    /// <summary>
    /// 최소 JSON 파서. 세이브 파일을 읽기 위한 것이며 관대하지 않다 —
    /// 깨진 세이브를 조용히 기본값으로 채우는 것이 가장 나쁜 실패다.
    /// </summary>
    public static class Json
    {
        public static JsonValue Parse(string text)
        {
            int i = 0;
            JsonValue value = ParseValue(text, ref i);
            SkipWhitespace(text, ref i);
            if (i != text.Length) throw new FormatException($"JSON 뒤에 잉여 문자 (위치 {i})");
            return value;
        }

        private static JsonValue ParseValue(string s, ref int i)
        {
            SkipWhitespace(s, ref i);
            if (i >= s.Length) throw new FormatException("JSON이 갑자기 끝났다");

            switch (s[i])
            {
                case '{': return ParseObject(s, ref i);
                case '[': return ParseArray(s, ref i);
                case '"': return new JsonString(ParseString(s, ref i));
                case 't': Expect(s, ref i, "true"); return new JsonBool(true);
                case 'f': Expect(s, ref i, "false"); return new JsonBool(false);
                case 'n': Expect(s, ref i, "null"); return JsonNull.Instance;
                default: return ParseNumber(s, ref i);
            }
        }

        private static JsonObject ParseObject(string s, ref int i)
        {
            var obj = new JsonObject();
            i += 1; // '{'
            SkipWhitespace(s, ref i);
            if (Peek(s, i) == '}') { i += 1; return obj; }

            while (true)
            {
                SkipWhitespace(s, ref i);
                string key = ParseString(s, ref i);
                SkipWhitespace(s, ref i);
                if (Peek(s, i) != ':') throw new FormatException($"':' 기대 (위치 {i})");
                i += 1;
                obj.Set(key, ParseValue(s, ref i));
                SkipWhitespace(s, ref i);
                char c = Peek(s, i);
                i += 1;
                if (c == '}') return obj;
                if (c != ',') throw new FormatException($"',' 또는 '}}' 기대 (위치 {i - 1})");
            }
        }

        private static JsonArray ParseArray(string s, ref int i)
        {
            var array = new JsonArray();
            i += 1; // '['
            SkipWhitespace(s, ref i);
            if (Peek(s, i) == ']') { i += 1; return array; }

            while (true)
            {
                array.Add(ParseValue(s, ref i));
                SkipWhitespace(s, ref i);
                char c = Peek(s, i);
                i += 1;
                if (c == ']') return array;
                if (c != ',') throw new FormatException($"',' 또는 ']' 기대 (위치 {i - 1})");
            }
        }

        private static string ParseString(string s, ref int i)
        {
            if (Peek(s, i) != '"') throw new FormatException($"문자열 기대 (위치 {i})");
            i += 1;
            var sb = new StringBuilder();
            while (true)
            {
                if (i >= s.Length) throw new FormatException("닫히지 않은 문자열");
                char c = s[i];
                i += 1;
                if (c == '"') return sb.ToString();
                if (c != '\\') { sb.Append(c); continue; }

                if (i >= s.Length) throw new FormatException("닫히지 않은 이스케이프");
                char esc = s[i];
                i += 1;
                switch (esc)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw new FormatException("짧은 \\u 이스케이프");
                        sb.Append((char)ushort.Parse(s.Substring(i, 4), NumberStyles.HexNumber,
                                                    CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: throw new FormatException($"알 수 없는 이스케이프 \\{esc}");
                }
            }
        }

        private static JsonNumber ParseNumber(string s, ref int i)
        {
            int start = i;
            if (Peek(s, i) == '-') i += 1;
            while (i < s.Length && (char.IsDigit(s[i]) || s[i] == '.' || s[i] == 'e' || s[i] == 'E'
                                    || s[i] == '+' || s[i] == '-')) i += 1;
            string raw = s.Substring(start, i - start);
            if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out double value))
                throw new FormatException($"숫자가 아니다: '{raw}' (위치 {start})");
            return new JsonNumber(value);
        }

        private static void Expect(string s, ref int i, string literal)
        {
            if (i + literal.Length > s.Length ||
                string.CompareOrdinal(s, i, literal, 0, literal.Length) != 0)
                throw new FormatException($"'{literal}' 기대 (위치 {i})");
            i += literal.Length;
        }

        private static char Peek(string s, int i) =>
            i < s.Length ? s[i] : throw new FormatException("JSON이 갑자기 끝났다");

        private static void SkipWhitespace(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i += 1;
        }
    }
}
