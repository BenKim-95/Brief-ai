package app.brief.news;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.List;

/** 위젯 데이터 처리 확인(안드로이드 기기 없이 JUnit 으로 돈다: ./gradlew test). */
public class WidgetDataTest {
    @Test
    public void normalizeBase_accepts_http_and_https_and_strips_trailing_slashes() {
        assertEquals("https://brief.example.com", WidgetData.normalizeBase("  https://brief.example.com//  "));
        assertEquals("http://10.0.2.2:3000", WidgetData.normalizeBase("http://10.0.2.2:3000/"));
        assertNull(WidgetData.normalizeBase("brief.example.com"));
        assertNull(WidgetData.normalizeBase("ftp://x.com"));
        assertNull(WidgetData.normalizeBase("https://"));
        assertNull(WidgetData.normalizeBase(null));
    }

    @Test
    public void baseUrlFromConfig_reads_server_url() {
        assertEquals(
                "https://brief.example.com",
                WidgetData.baseUrlFromConfig("{\"appId\":\"a\",\"server\":{\"url\":\"https://brief.example.com/\"}}"));
        assertNull(WidgetData.baseUrlFromConfig("{\"appId\":\"a\"}"));
        assertNull(WidgetData.baseUrlFromConfig("{\"server\":{\"cleartext\":true}}"));
        assertNull(WidgetData.baseUrlFromConfig("not json"));
    }

    @Test
    public void parseItems_limits_count_and_skips_bad_entries() {
        String json = "{\"items\":["
                + "{\"id\":1,\"title\":\"가\",\"summary\":\"요약1\",\"path\":\"/articles/1\"},"
                + "{\"id\":2,\"title\":\"\",\"summary\":\"제목 없음\",\"path\":\"/articles/2\"},"
                + "{\"id\":3,\"title\":\"나\",\"summary\":\"요약3\",\"path\":\"https://evil.example/x\"},"
                + "{\"id\":4,\"title\":\"다\",\"summary\":\"요약4\",\"path\":\"/articles/4\"},"
                + "{\"id\":5,\"title\":\"라\",\"summary\":\"요약5\",\"path\":\"/articles/5\"}]}";
        List<WidgetData.Item> items = WidgetData.parseItems(json, 2);
        assertEquals(2, items.size());
        assertEquals("가", items.get(0).title);
        assertEquals("/articles/4", items.get(1).path);
    }

    @Test
    public void parseItems_returns_empty_for_broken_json() {
        assertTrue(WidgetData.parseItems("<html>", 3).isEmpty());
        assertTrue(WidgetData.parseItems("{\"items\":\"x\"}", 3).isEmpty());
    }

    @Test
    public void join_only_opens_paths_inside_the_site() {
        assertEquals("https://b.com/articles/7", WidgetData.join("https://b.com", "/articles/7"));
        assertEquals("https://b.com", WidgetData.join("https://b.com", "//evil.com/x"));
        assertEquals("https://b.com", WidgetData.join("https://b.com", "https://evil.com"));
        assertEquals("https://b.com", WidgetData.join("https://b.com", null));
        assertFalse(WidgetData.isAppPath("/a\\b"));
    }
}
