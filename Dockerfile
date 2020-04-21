FROM ubuntu:bionic
MAINTAINER Ben West <bewest@gmail.com>

ENV DEBIAN_FRONTEND noninteractive
ENV PORT=3000

RUN apt-get update -y
RUN apt-get install -y wget curl git sudo
RUN curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -

RUN apt-get update
RUN apt-get install -y python software-properties-common nodejs build-essential nginx ruby
RUN npm install -g n
RUN n 12.16.2
RUN n prune

ADD . /app

WORKDIR /app

# "configure nginx"
# forward request and error logs to docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stdout /var/log/nginx/error.log
# RUN erb nginx.conf.erb | tee /etc/nginx/nginx.conf
# clean things
RUN cd /app && rm -rf node_modules
# RUN cd /app && npm cache clean

RUN cd /app && npm install
EXPOSE 4747
EXPOSE 3737
EXPOSE 3000
RUN /app/setup_docker_guest.sh


CMD /app/start_container.sh
