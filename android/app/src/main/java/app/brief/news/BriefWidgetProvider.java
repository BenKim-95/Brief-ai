package app.brief.news;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

/**
 * 홈 화면 위젯: 최신 뉴스 제목과 짧은 요약을 보여주고, 누르면 앱에서 그 기사를 연다.
 * 서버 주소는 앱에 들어 있는 capacitor.config.json(server.url)에서 읽는다(CAP_SERVER_URL 로 만든 값).
 * 주소는 https 여야 한다(위젯은 http 평문 통신을 쓰지 않는다).
 */
public class BriefWidgetProvider extends AppWidgetProvider {
    static final int MAX_ITEMS = 3;
    private static final int TIMEOUT_MS = 8000;
    private static final int MAX_BYTES = 64 * 1024;

    private static final int[] ROWS = {R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3};
    private static final int[] TITLES = {R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3};
    private static final int[] SUMMARIES = {R.id.widget_summary_1, R.id.widget_summary_2, R.id.widget_summary_3};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        // 네트워크는 메인 스레드에서 못 쓰므로 goAsync 로 잠깐 백그라운드에서 처리한다.
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                String base = readBaseUrl(app);
                List<WidgetData.Item> items = null;
                String message;
                if (base == null) {
                    message = app.getString(R.string.widget_no_server);
                } else if (!base.startsWith("https://")) {
                    message = app.getString(R.string.widget_need_https);
                } else {
                    try {
                        items = WidgetData.parseItems(httpGet(base + "/api/widget/latest?limit=" + MAX_ITEMS), MAX_ITEMS);
                        message = items.isEmpty() ? app.getString(R.string.widget_empty) : null;
                    } catch (IOException e) {
                        message = app.getString(R.string.widget_load_failed);
                    }
                }
                for (int id : appWidgetIds) {
                    manager.updateAppWidget(id, build(app, base, items, message, id));
                }
            } finally {
                pending.finish();
            }
        }).start();
    }

    private static RemoteViews build(Context ctx, String base, List<WidgetData.Item> items, String message, int widgetId) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_brief);
        // 머리글을 누르면 앱 홈으로
        views.setOnClickPendingIntent(R.id.widget_header, openApp(ctx, base, "/", widgetId * 10));

        if (message != null) {
            views.setViewVisibility(R.id.widget_message, View.VISIBLE);
            views.setTextViewText(R.id.widget_message, message);
        } else {
            views.setViewVisibility(R.id.widget_message, View.GONE);
        }
        for (int i = 0; i < ROWS.length; i++) {
            if (items != null && i < items.size()) {
                WidgetData.Item item = items.get(i);
                views.setViewVisibility(ROWS[i], View.VISIBLE);
                views.setTextViewText(TITLES[i], item.title);
                views.setTextViewText(SUMMARIES[i], item.summary);
                views.setViewVisibility(SUMMARIES[i], item.summary.isEmpty() ? View.GONE : View.VISIBLE);
                views.setOnClickPendingIntent(ROWS[i], openApp(ctx, base, item.path, widgetId * 10 + i + 1));
            } else {
                views.setViewVisibility(ROWS[i], View.GONE);
            }
        }
        return views;
    }

    /**
     * 앱을 열면서 기사 주소를 ACTION_VIEW 로 넘긴다. 앱 안의 웹 화면(NativeLinkHandler)이
     * Capacitor App 플러그인의 appUrlOpen 으로 받아 그 경로로 이동한다.
     * 항상 우리 앱(MainActivity)을 명시해서 열고, 주소는 서버 주소 + 앱 안 경로로만 만든다.
     */
    private static PendingIntent openApp(Context ctx, String base, String path, int requestCode) {
        Intent intent = new Intent(ctx, MainActivity.class);
        if (base != null) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(WidgetData.join(base, path)));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String readBaseUrl(Context ctx) {
        try (InputStream in = ctx.getAssets().open("capacitor.config.json")) {
            return WidgetData.baseUrlFromConfig(readAll(in));
        } catch (IOException e) {
            return null;
        }
    }

    private static String httpGet(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        try {
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            conn.setRequestProperty("Accept", "application/json");
            if (conn.getResponseCode() != 200) throw new IOException("HTTP " + conn.getResponseCode());
            try (InputStream in = conn.getInputStream()) {
                return readAll(in);
            }
        } finally {
            conn.disconnect();
        }
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
            if (out.size() > MAX_BYTES) throw new IOException("응답이 너무 커요");
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
