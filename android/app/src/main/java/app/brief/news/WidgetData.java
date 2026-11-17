package app.brief.news;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * 위젯이 쓰는 순수 데이터 처리(네트워크·화면과 분리해서 JUnit 으로 확인할 수 있게 했다).
 * 서버(/api/widget/latest)가 주는 JSON 과 앱의 capacitor.config.json 을 읽는다.
 */
final class WidgetData {
    private WidgetData() {}

    static final class Item {
        final int id;
        final String title;
        final String summary;
        /** 앱 안 경로. 항상 "/"로 시작하고 "//"로 시작하지 않는다. */
        final String path;

        Item(int id, String title, String summary, String path) {
            this.id = id;
            this.title = title;
            this.summary = summary;
            this.path = path;
        }
    }

    /** 앞뒤 공백과 끝의 "/"를 지우고, http(s) 주소가 아니면 null. */
    static String normalizeBase(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        String rest;
        if (s.startsWith("https://")) rest = s.substring("https://".length());
        else if (s.startsWith("http://")) rest = s.substring("http://".length());
        else return null;
        // 스킴 뒤에 호스트가 있어야 한다("https://" 만 있는 값은 거부)
        if (rest.isEmpty() || rest.startsWith("/")) return null;
        return s;
    }

    /** capacitor.config.json 의 server.url. 없거나 올바르지 않으면 null. */
    static String baseUrlFromConfig(String configJson) {
        try {
            JSONObject server = new JSONObject(configJson).optJSONObject("server");
            if (server == null) return null;
            return normalizeBase(server.optString("url", null));
        } catch (JSONException e) {
            return null;
        }
    }

    /** 서버 응답에서 최대 max 개. 모양이 틀린 항목은 건너뛴다. */
    static List<Item> parseItems(String json, int max) {
        List<Item> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONObject(json).getJSONArray("items");
            for (int i = 0; i < arr.length() && out.size() < max; i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                String title = o.optString("title", "").trim();
                String path = o.optString("path", "");
                if (title.isEmpty() || !isAppPath(path)) continue;
                out.add(new Item(o.optInt("id", 0), title, o.optString("summary", "").trim(), path));
            }
        } catch (JSONException e) {
            return new ArrayList<>();
        }
        return out;
    }

    /** "/articles/7" 같은 앱 안 경로만 허용한다("//host" 나 "https://…" 는 거부). */
    static boolean isAppPath(String path) {
        return path != null && path.startsWith("/") && !path.startsWith("//") && !path.contains("\\");
    }

    /** base + path. path 가 앱 안 경로가 아니면 base 만 돌려준다(항상 같은 사이트 안에서만 연다). */
    static String join(String base, String path) {
        return isAppPath(path) ? base + path : base;
    }
}
