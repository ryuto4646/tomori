#!/usr/bin/perl
use strict;
use warnings;
use Socket;
use POSIX qw(SIGCHLD SIG_DFL);

my $port = $ARGV[0] || 3456;
my $root = $ARGV[1] || '.';

$SIG{CHLD} = 'IGNORE';

socket(my $server, PF_INET, SOCK_STREAM, getprotobyname('tcp')) or die "socket: $!";
setsockopt($server, SOL_SOCKET, SO_REUSEADDR, 1);
bind($server, sockaddr_in($port, INADDR_ANY)) or die "bind: $!";
listen($server, 10) or die "listen: $!";
print "Serving $root on http://localhost:$port/\n";

while (accept(my $client, $server)) {
    my $pid = fork();
    if (!defined $pid) { close $client; next; }
    if ($pid) { close $client; next; }

    # Child process
    my $req = '';
    while (my $line = <$client>) {
        $req .= $line;
        last if $line eq "\r\n" || $line eq "\n";
    }
    my ($method, $path) = $req =~ /^(\w+)\s+(\S+)/;
    $path = '/' unless $path;
    $path =~ s/\?.*$//;
    $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
    $path = '/index.html' if $path eq '/';

    my $file = $root . $path;
    $file =~ s|//+|/|g;

    my %mime = (
        html => 'text/html; charset=utf-8',
        htm  => 'text/html; charset=utf-8',
        css  => 'text/css',
        js   => 'application/javascript',
        json => 'application/json',
        png  => 'image/png',
        jpg  => 'image/jpeg',
        jpeg => 'image/jpeg',
        gif  => 'image/gif',
        svg  => 'image/svg+xml',
        ico  => 'image/x-icon',
        woff => 'font/woff',
        woff2=> 'font/woff2',
        ttf  => 'font/ttf',
    );
    my ($ext) = $file =~ /\.(\w+)$/;
    my $ct = $mime{lc($ext || '')} || 'application/octet-stream';

    if (-f $file) {
        open(my $fh, '<:raw', $file) or do {
            print $client "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n";
            close $client; exit;
        };
        my @stat = stat($fh);
        my $size = $stat[7];
        print $client "HTTP/1.1 200 OK\r\nContent-Type: $ct\r\nContent-Length: $size\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
        my $buf;
        while (read($fh, $buf, 8192)) { print $client $buf; }
        close $fh;
    } else {
        my $body = "404 Not Found: $path";
        printf $client "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: %d\r\n\r\n%s",
            length($body), $body;
    }
    close $client;
    exit;
}
