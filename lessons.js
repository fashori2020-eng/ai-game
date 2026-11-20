export const lessons = [
{title:'مدیریت بازیکن',en:'PLAYER MANAGEMENT',icon:'users',desc:'مدیریت سلامتی بازیکن و اعمال آسیب در یک مسابقهٔ آزمایشی.',bad:`// ضعف‌های عمده: نام مبهم، اعداد جادویی، وضعیت سراسری
using UnityEngine;

public class BadPlayer : MonoBehaviour
{
    public static int x = 100;

    void Start()
    {
        x = 100;
        D(25);
        Debug.Log(x);
    }

    public void D(int a)
    {
        x = x - a;
        if (x < 0) x = 0;
    }
}`,issues:['نام‌های x و D هدف متغیر و متد را مشخص نمی‌کنند.','سلامتی static بین همهٔ بازیکنان مشترک است.','مقادیر ۱۰۰ و ۲۵ بدون نام یا تنظیمات مشخص‌اند.','آسیب منفی سلامتی را به‌اشتباه افزایش می‌دهد.'],good:`using UnityEngine;

public class GoodPlayer : MonoBehaviour
{
    const int MaxHealth = 100;
    const int DemoDamage = 25;
    public int Health { get; private set; } = MaxHealth;

    void Start()
    {
        ApplyDamage(DemoDamage);
        Debug.Log(Health);
    }

    public void ApplyDamage(int damage)
    {
        if (damage <= 0) return;
        Health = Mathf.Max(0, Health - damage);
    }
}`},
{title:'شبکه و پیام‌رسانی',en:'NETWORK MESSAGING',icon:'network',desc:'شبیه‌سازی دریافت پیام لابی، بدون اتصال یا سرویس واقعی.',bad:`// ضعف‌های عمده: اشتراک تکراری، نبود پاک‌سازی، نبود اعتبارسنجی
using System;
using UnityEngine;

public class BadLobby : MonoBehaviour
{
    static event Action<string> Messages;

    void OnEnable()
    {
        Messages += s => Debug.Log(s.Trim());
        Messages += s => Debug.Log(s.Trim());
        Receive(" Lobby ready ");
    }

    public static void Receive(string s) => Messages?.Invoke(s);
}`,issues:['هر پیام دو بار ثبت می‌شود.','رویداد سراسری هنگام غیرفعال شدن پاک نمی‌شود.','ورودی تهی هنگام Trim خطا می‌دهد.'],good:`using System;
using UnityEngine;

public class GoodLobby : MonoBehaviour
{
    static event Action<string> Messages;
    void OnEnable()
    {
        Messages += LogMessage;
        Receive(" Lobby ready ");
    }
    void OnDisable() => Messages -= LogMessage;
    static void LogMessage(string text) => Debug.Log(text);

    public static void Receive(string text)
    {
        if (!string.IsNullOrWhiteSpace(text)) Messages?.Invoke(text.Trim());
    }
}`},
{title:'بارگذاری مپ',en:'MAP LOADING',icon:'map',desc:'انتخاب و بارگذاری صحنهٔ تمرینی از فهرست صحنه‌های پروژه.',bad:`// ضعف‌های عمده: کپی‌پیست، اعداد جادویی، بارگذاری همگام
using UnityEngine;
using UnityEngine.SceneManagement;

public class BadMap : MonoBehaviour
{
    public void Load(int x)
    {
        if (x == 0) SceneManager.LoadScene(1);
        if (x == 1) SceneManager.LoadScene(2);
        if (x == 2) SceneManager.LoadScene(3);
    }
}`,issues:['برای هر مپ همان فراخوانی تکرار می‌شود.','ارتباط شمارهٔ مپ و شناسهٔ صحنه در شرط‌ها پنهان است.','برای ورودی نامعتبر یا صحنهٔ ثبت‌نشده پیام روشنی وجود ندارد.','بارگذاری همگام ممکن است بازی را موقتاً متوقف کند.'],good:`using UnityEngine;
using UnityEngine.SceneManagement;

public class GoodMap : MonoBehaviour
{
    [SerializeField] string[] maps = { "Depot", "Docks", "Arena" };

    public void Load(int index)
    {
        if (index < 0 || index >= maps.Length ||
            !Application.CanStreamedLevelBeLoaded(maps[index]))
        {
            Debug.LogWarning("Map unavailable.");
            return;
        }
        SceneManager.LoadSceneAsync(maps[index]);
    }
}`},
{title:'سیستم امتیاز',en:'SCORING SYSTEM',icon:'trophy',desc:'ثبت امتیاز رویدادهای مسابقه و جداسازی امتیاز هر بازیکن.',bad:`// ضعف‌های عمده: وضعیت سراسری، تکرار، رشته‌ها و اعداد جادویی
using UnityEngine;

public class BadScore : MonoBehaviour
{
    public static int s;
    void Start() => Add("capture");

    public void Add(string x)
    {
        if (x == "capture") { s += 100; Debug.Log(s); }
        if (x == "assist") { s += 25; Debug.Log(s); }
    }
}`,issues:['امتیاز سراسری بازیکنان را از هم جدا نمی‌کند.','ثبت امتیاز در هر شاخه تکرار شده است.','اشتباه تایپی در رویداد بدون بازخورد نادیده گرفته می‌شود.'],good:`using UnityEngine;

public class GoodScore : MonoBehaviour
{
    const int CapturePoints = 100, AssistPoints = 25;
    public enum MatchEvent { Capture, Assist }
    public int Score { get; private set; }
    void Start() => Add(MatchEvent.Capture);

    public void Add(MatchEvent matchEvent)
    {
        switch (matchEvent)
        {
            case MatchEvent.Capture: Score += CapturePoints; break;
            case MatchEvent.Assist: Score += AssistPoints; break;
            default: Debug.LogWarning("Unknown event."); return;
        }
        Debug.Log(Score);
    }
}`},
{title:'مدیریت سلاح',en:'WEAPON INVENTORY',icon:'crosshair',desc:'مدیریت ظرفیت و مصرف انرژی یک آیتم کاملاً خیالی در بازی.',bad:`// ضعف‌های عمده: وضعیت عمومی، عدد جادویی، نبود کنترل ظرفیت
using UnityEngine;

public class BadWeapon : MonoBehaviour
{
    public int n = 12;
    void Start() { Use(); Use(); Debug.Log(n); }
    public void Use() => n--;
    public void Refill() => n = 12;
}`,issues:['وضعیت عمومی از بیرون بدون محدودیت تغییر می‌کند.','ظرفیت ۱۲ در چند محل تکرار شده است.','مصرف در حالت خالی مقدار منفی تولید می‌کند.'],good:`using UnityEngine;

public class GoodWeapon : MonoBehaviour
{
    const int Capacity = 12;
    public int Energy { get; private set; } = Capacity;
    void Start() { TryUse(); TryUse(); Debug.Log(Energy); }

    public bool TryUse()
    {
        if (Energy == 0) return false;
        Energy--;
        return true;
    }

    public void Refill() => Energy = Capacity;
}`}];
export const summary = ['نام‌های روشن، مسئولیت متغیر و متد را بدون حدس زدن نشان می‌دهند.','ثابت‌های نام‌دار و حذف تکرار، تغییر قوانین بازی را ساده‌تر می‌کنند.','وضعیت مشترک را تنها در صورت نیاز نگه دارید و مالک آن را مشخص کنید.','ورودی نامعتبر و منابع ناموجود را در مرز هر سیستم بررسی کنید.','چرخهٔ عمر اشتراک‌ها و حالت‌های مرزی مثل ظرفیت صفر را با تست بررسی کنید.'];
export const guide = 'هر کلاس را در فایل هم‌نام ذخیره و به یک GameObject اضافه کنید. در نمونهٔ مپ، صحنه‌ها را به Build Settings یا Build Profiles اضافه کنید و Load را از یک دکمهٔ UI فراخوانی کنید. برای نسخهٔ ضعیف صحنه‌ها باید در اندیس‌های ۱ تا ۳ باشند؛ برای نسخهٔ درست نام‌ها را در Inspector تنظیم کنید.';
